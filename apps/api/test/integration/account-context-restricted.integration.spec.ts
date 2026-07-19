import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentAccountContext } from "@gym-platform/contracts";
import { Prisma, type PrismaClient } from "@gym-platform/database";

import {
  PrismaService,
  type ActorDatabaseContext
} from "../../src/infrastructure/database/prisma.service.js";
import { createTestApp } from "../test-app.js";
import {
  assertDatabaseAvailable,
  createTestPrismaClient,
  resetDatabase
} from "../test-database.js";
import { configureIntegrationTestEnv } from "../test-env.js";

const runtimeRole = "wefit_context_runtime_test";
const missingExecuteRole = "wefit_context_missing_execute_test";

const organizationAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const archivedOrganizationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const unitA1Id = "aaaaaaaa-1111-4111-8111-111111111111";
const unitA2Id = "aaaaaaaa-2222-4222-8222-222222222222";
const unitB1Id = "bbbbbbbb-1111-4111-8111-111111111111";
const archivedUnitId = "aaaaaaaa-9999-4999-8999-999999999999";
const archivedOrganizationUnitId = "cccccccc-1111-4111-8111-111111111111";

const globalUserId = "11111111-1111-4111-8111-111111111111";
const unitUserId = "22222222-2222-4222-8222-222222222222";
const tenantBUserId = "33333333-3333-4333-8333-333333333333";
const noMembershipUserId = "44444444-4444-4444-8444-444444444444";
const archivedUserId = "55555555-5555-4555-8555-555555555555";
const noRoleUserId = "66666666-6666-4666-8666-666666666666";
const archivedUnitUserId = "77777777-7777-4777-8777-777777777777";
const archivedOrganizationUserId = "88888888-8888-4888-8888-888888888888";
const multiOrganizationUserId = "99999999-9999-4999-8999-999999999999";

configureIntegrationTestEnv();

describe("authenticated account context with a restricted PostgreSQL role", () => {
  const adminPrisma = createTestPrismaClient();
  const runtimePrisma = new RoleAssumingPrismaService(runtimeRole);
  const missingExecutePrisma = new RoleAssumingPrismaService(missingExecuteRole);
  let app: NestFastifyApplication;
  let missingExecuteApp: NestFastifyApplication;

  beforeAll(async () => {
    await assertDatabaseAvailable(adminPrisma);
    await resetDatabase(adminPrisma);
    await provisionRestrictedRoles(adminPrisma);
    await seedAccountContexts(adminPrisma);

    app = await createTestApp({ prismaService: runtimePrisma });
    missingExecuteApp = await createTestApp({ prismaService: missingExecutePrisma });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await missingExecuteApp?.close();

    const rlsPosture = await readRlsPosture(adminPrisma);
    await resetDatabase(adminPrisma);
    await removeRestrictedRoles(adminPrisma);
    await adminPrisma.$disconnect();

    expect(rlsPosture.length).toBeGreaterThan(0);
    expect(rlsPosture.every((table) => table.rlsEnabled && table.rlsForced)).toBe(true);
  }, 60_000);

  it("rejects requests without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/me/context" });

    expect(response.statusCode).toBe(401);
  });

  it("rejects an invalid actor identifier", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me/context",
      headers: { "x-dev-user-id": "not-a-uuid" }
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns every active unit to an organization-global owner", async () => {
    const context = await getContext(globalUserId);

    expect(context.organizations).toEqual([
      expect.objectContaining({
        id: organizationAId,
        isGlobalMember: true,
        units: [
          expect.objectContaining({ id: unitA1Id }),
          expect.objectContaining({ id: unitA2Id })
        ]
      })
    ]);
  });

  it("limits a unit-scoped actor to the assigned active unit", async () => {
    const context = await getContext(unitUserId);

    expect(context.organizations).toEqual([
      expect.objectContaining({
        id: organizationAId,
        isGlobalMember: false,
        units: [expect.objectContaining({ id: unitA1Id })],
        roles: [expect.objectContaining({ scope: "UNIT", unitId: unitA1Id })]
      })
    ]);
  });

  it("does not leak Tenant A into Tenant B context", async () => {
    const context = await getContext(tenantBUserId);

    expect(context.organizations.map(({ id }) => id)).toEqual([organizationBId]);
    expect(context.organizations[0]?.units.map(({ id }) => id)).toEqual([unitB1Id]);
  });

  it("returns both authorized organizations without cross-tenant units", async () => {
    const context = await getContext(multiOrganizationUserId);

    expect(context.organizations.map(({ id }) => id).sort()).toEqual(
      [organizationAId, organizationBId].sort()
    );
    expect(
      context.organizations.find(({ id }) => id === organizationAId)?.units.map(({ id }) => id)
    ).toEqual([unitA1Id, unitA2Id]);
    expect(
      context.organizations.find(({ id }) => id === organizationBId)?.units.map(({ id }) => id)
    ).toEqual([unitB1Id]);
  });

  it("returns no organizations for an actor without membership", async () => {
    const context = await getContext(noMembershipUserId);

    expect(context.user.name).toBe("Sem membership");
    expect(context.organizations).toEqual([]);
  });

  it("returns no business context for an archived actor", async () => {
    const context = await getContext(archivedUserId);

    expect(context.user).toEqual({ id: archivedUserId, name: null });
    expect(context.organizations).toEqual([]);
  });

  it("returns no organization for a membership without a role", async () => {
    expect((await getContext(noRoleUserId)).organizations).toEqual([]);
  });

  it("returns no organization when the only role points to an archived unit", async () => {
    expect((await getContext(archivedUnitUserId)).organizations).toEqual([]);
  });

  it("returns no organization when the organization is archived", async () => {
    expect((await getContext(archivedOrganizationUserId)).organizations).toEqual([]);
  });

  it("runs as a non-login, non-owner and non-bypass role that inherits only the consumer", async () => {
    const posture = await runtimePrisma.readPosture();

    expect(posture).toMatchObject({
      roleName: runtimeRole,
      canLogin: false,
      isSuperuser: false,
      bypassesRls: false,
      ownsBusinessTables: 0,
      isContextConsumer: true,
      isContextReader: false
    });
  });

  it("fails predictably when the runtime lacks function EXECUTE", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await missingExecuteApp.inject({
        method: "GET",
        url: "/me/context",
        headers: authHeaders(globalUserId)
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.payload)).toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error."
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  async function getContext(userId: string): Promise<CurrentAccountContext> {
    const response = await app.inject({
      method: "GET",
      url: "/me/context",
      headers: authHeaders(userId)
    });

    expect(response.statusCode).toBe(200);
    return JSON.parse(response.payload) as CurrentAccountContext;
  }
});

class RoleAssumingPrismaService extends PrismaService {
  constructor(private readonly restrictedRole: typeof runtimeRole | typeof missingExecuteRole) {
    super({
      datasources: {
        db: {
          url: readTestDatabaseUrl()
        }
      }
    });
  }

  override withActorContext<T>(
    context: ActorDatabaseContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await assumeRestrictedRole(tx, this.restrictedRole);
      await tx.$executeRaw`
        SELECT
          set_config('app.organization_id', '', true),
          set_config('app.unit_id', '', true),
          set_config('app.actor_user_id', ${context.actorUserId || ""}, true),
          set_config('app.correlation_id', ${context.correlationId || ""}, true)
      `;
      return fn(tx);
    }, options);
  }

  readPosture() {
    return this.$transaction(async (tx) => {
      await assumeRestrictedRole(tx, this.restrictedRole);
      const [posture] = await tx.$queryRaw<
        Array<{
          roleName: string;
          canLogin: boolean;
          isSuperuser: boolean;
          bypassesRls: boolean;
          ownsBusinessTables: number;
          isContextConsumer: boolean;
          isContextReader: boolean;
        }>
      >`
        SELECT
          role.rolname AS "roleName",
          role.rolcanlogin AS "canLogin",
          role.rolsuper AS "isSuperuser",
          role.rolbypassrls AS "bypassesRls",
          (
            SELECT count(*)::integer
            FROM pg_catalog.pg_class AS business_table
            INNER JOIN pg_catalog.pg_namespace AS business_schema
              ON business_schema.oid = business_table.relnamespace
            WHERE business_schema.nspname = 'public'
              AND business_table.relkind IN ('r', 'p')
              AND business_table.relname <> '_prisma_migrations'
              AND business_table.relowner = role.oid
          ) AS "ownsBusinessTables",
          pg_catalog.pg_has_role(role.oid, 'wefit_context_consumer', 'MEMBER')
            AS "isContextConsumer",
          pg_catalog.pg_has_role(role.oid, 'wefit_context_reader', 'MEMBER')
            AS "isContextReader"
        FROM pg_catalog.pg_roles AS role
        WHERE role.rolname = current_user
      `;

      if (!posture) {
        throw new Error("Restricted database role posture is unavailable.");
      }

      return posture;
    });
  }
}

async function assumeRestrictedRole(
  tx: Prisma.TransactionClient,
  role: typeof runtimeRole | typeof missingExecuteRole
): Promise<void> {
  // Identifiers cannot be bound by Prisma. The value is constrained to this fixed test-only allow-list.
  if (role === runtimeRole) {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE "${runtimeRole}"`);
    return;
  }

  await tx.$executeRawUnsafe(`SET LOCAL ROLE "${missingExecuteRole}"`);
}

async function provisionRestrictedRoles(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${runtimeRole}') THEN
        CREATE ROLE ${runtimeRole} NOLOGIN;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${missingExecuteRole}'
      ) THEN
        CREATE ROLE ${missingExecuteRole} NOLOGIN;
      END IF;
    END
    $$;

  `);
  await prisma.$executeRawUnsafe(
    `ALTER ROLE ${runtimeRole} NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS NOLOGIN`
  );
  await prisma.$executeRawUnsafe(
    `ALTER ROLE ${missingExecuteRole} NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS NOLOGIN`
  );
  await prisma.$executeRawUnsafe(
    `GRANT USAGE ON SCHEMA public TO ${runtimeRole}, ${missingExecuteRole}`
  );
  await prisma.$executeRawUnsafe(`GRANT wefit_context_consumer TO ${runtimeRole}`);
  await prisma.$executeRawUnsafe(
    `REVOKE wefit_context_reader FROM ${runtimeRole}, ${missingExecuteRole}`
  );
  await prisma.$executeRawUnsafe(`REVOKE wefit_context_consumer FROM ${missingExecuteRole}`);
}

async function removeRestrictedRoles(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`REVOKE wefit_context_consumer FROM ${runtimeRole}`);
  await prisma.$executeRawUnsafe(
    `REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${runtimeRole}, ${missingExecuteRole}`
  );
  await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${runtimeRole}`);
  await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${missingExecuteRole}`);
}

async function readRlsPosture(prisma: PrismaClient) {
  return prisma.$queryRaw<Array<{ tableName: string; rlsEnabled: boolean; rlsForced: boolean }>>`
    SELECT
      table_state.relname AS "tableName",
      table_state.relrowsecurity AS "rlsEnabled",
      table_state.relforcerowsecurity AS "rlsForced"
    FROM pg_catalog.pg_class AS table_state
    INNER JOIN pg_catalog.pg_namespace AS table_schema
      ON table_schema.oid = table_state.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_state.relname IN (
        'Organization',
        'Unit',
        'Membership',
        'Role',
        'MembershipRole',
        'RolePermission',
        'OrganizationSubscription',
        'Student',
        'StudentUnit',
        'AuditLog'
      )
  `;
}

async function seedAccountContexts(prisma: PrismaClient): Promise<void> {
  const now = new Date();

  await prisma.organization.createMany({
    data: [
      { id: organizationAId, type: "NETWORK", legalName: "Tenant A", slug: "tenant-a" },
      { id: organizationBId, type: "GYM", legalName: "Tenant B", slug: "tenant-b" },
      {
        id: archivedOrganizationId,
        type: "GYM",
        legalName: "Tenant arquivado",
        slug: "tenant-arquivado",
        deletedAt: now
      }
    ]
  });
  await prisma.unit.createMany({
    data: [
      { id: unitA1Id, organizationId: organizationAId, name: "Unidade A1", code: "A1" },
      { id: unitA2Id, organizationId: organizationAId, name: "Unidade A2", code: "A2" },
      { id: unitB1Id, organizationId: organizationBId, name: "Unidade B1", code: "B1" },
      {
        id: archivedUnitId,
        organizationId: organizationAId,
        name: "Unidade arquivada",
        code: "ARCHIVED",
        deletedAt: now
      },
      {
        id: archivedOrganizationUnitId,
        organizationId: archivedOrganizationId,
        name: "Unidade de tenant arquivado",
        code: "ORG_ARCHIVED"
      }
    ]
  });
  await prisma.user.createMany({
    data: [
      { id: globalUserId, name: "Owner global", email: "global@example.test" },
      { id: unitUserId, name: "Gestor da unidade", email: "unit@example.test" },
      { id: tenantBUserId, name: "Owner B", email: "tenant-b@example.test" },
      { id: noMembershipUserId, name: "Sem membership", email: "no-membership@example.test" },
      {
        id: archivedUserId,
        name: "Usuario arquivado",
        email: "archived@example.test",
        deletedAt: now
      },
      { id: noRoleUserId, name: "Sem papel", email: "no-role@example.test" },
      {
        id: archivedUnitUserId,
        name: "Unidade arquivada",
        email: "archived-unit@example.test"
      },
      {
        id: archivedOrganizationUserId,
        name: "Tenant arquivado",
        email: "archived-organization@example.test"
      },
      {
        id: multiOrganizationUserId,
        name: "Duas organizacoes",
        email: "multi@example.test"
      }
    ]
  });

  const roleAId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
  const roleBId = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
  const archivedOrganizationRoleId = "cccccccc-cccc-4ccc-8ccc-000000000001";
  await prisma.role.createMany({
    data: [
      { id: roleAId, organizationId: organizationAId, key: "owner", name: "Proprietario" },
      { id: roleBId, organizationId: organizationBId, key: "owner", name: "Proprietario" },
      {
        id: archivedOrganizationRoleId,
        organizationId: archivedOrganizationId,
        key: "owner",
        name: "Proprietario"
      }
    ]
  });

  const membershipInputs = [
    ["aaaaaaaa-0001-4001-8001-000000000001", organizationAId, globalUserId],
    ["aaaaaaaa-0002-4002-8002-000000000002", organizationAId, unitUserId],
    ["bbbbbbbb-0003-4003-8003-000000000003", organizationBId, tenantBUserId],
    ["aaaaaaaa-0005-4005-8005-000000000005", organizationAId, archivedUserId],
    ["aaaaaaaa-0006-4006-8006-000000000006", organizationAId, noRoleUserId],
    ["aaaaaaaa-0007-4007-8007-000000000007", organizationAId, archivedUnitUserId],
    ["cccccccc-0008-4008-8008-000000000008", archivedOrganizationId, archivedOrganizationUserId],
    ["aaaaaaaa-0009-4009-8009-000000000009", organizationAId, multiOrganizationUserId],
    ["bbbbbbbb-0010-4010-8010-000000000010", organizationBId, multiOrganizationUserId]
  ] as const;
  await prisma.membership.createMany({
    data: membershipInputs.map(([id, organizationId, userId]) => ({ id, organizationId, userId }))
  });

  const membershipByUser = new Map(
    membershipInputs.map(([id, organizationId, userId]) => [`${organizationId}:${userId}`, id])
  );
  const assignment = (
    id: string,
    organizationId: string,
    userId: string,
    roleId: string,
    unitId: string | null
  ) => ({
    id,
    organizationId,
    membershipId: membershipByUser.get(`${organizationId}:${userId}`)!,
    roleId,
    unitId
  });
  await prisma.membershipRole.createMany({
    data: [
      assignment(
        "10000000-0001-4001-8001-000000000001",
        organizationAId,
        globalUserId,
        roleAId,
        null
      ),
      assignment(
        "10000000-0002-4002-8002-000000000002",
        organizationAId,
        unitUserId,
        roleAId,
        unitA1Id
      ),
      assignment(
        "10000000-0003-4003-8003-000000000003",
        organizationBId,
        tenantBUserId,
        roleBId,
        null
      ),
      assignment(
        "10000000-0005-4005-8005-000000000005",
        organizationAId,
        archivedUserId,
        roleAId,
        null
      ),
      assignment(
        "10000000-0007-4007-8007-000000000007",
        organizationAId,
        archivedUnitUserId,
        roleAId,
        archivedUnitId
      ),
      assignment(
        "10000000-0008-4008-8008-000000000008",
        archivedOrganizationId,
        archivedOrganizationUserId,
        archivedOrganizationRoleId,
        null
      ),
      assignment(
        "10000000-0009-4009-8009-000000000009",
        organizationAId,
        multiOrganizationUserId,
        roleAId,
        null
      ),
      assignment(
        "10000000-0010-4010-8010-000000000010",
        organizationBId,
        multiOrganizationUserId,
        roleBId,
        null
      )
    ]
  });
}

function authHeaders(userId: string) {
  return { "x-dev-user-id": userId };
}

function readTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is required for restricted role integration tests.");
  }

  return databaseUrl;
}
