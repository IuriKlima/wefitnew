import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { OnboardingAvailability, OrganizationOnboardingView } from "@gym-platform/contracts";
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

const runtimeRole = "wefit_onboarding_runtime_test";
const actorUserId = "a1111111-1111-4111-8111-111111111111";
const otherUserId = "a2222222-2222-4222-8222-222222222222";

configureIntegrationTestEnv();

describe("guided onboarding with a restricted PostgreSQL role", () => {
  const adminPrisma = createTestPrismaClient();
  const runtimePrisma = new OnboardingRolePrismaService();
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await assertDatabaseAvailable(adminPrisma);
    await resetDatabase(adminPrisma);
    await provisionRuntimeRole(adminPrisma);
    await adminPrisma.user.createMany({
      data: [
        { id: actorUserId, name: "Owner restrito", email: "restricted-owner@example.test" },
        { id: otherUserId, name: "Outro ator", email: "other-restricted@example.test" }
      ]
    });
    process.env.ORGANIZATION_SELF_SERVICE_ENABLED = "true";
    app = await createTestApp({ prismaService: runtimePrisma });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await resetDatabase(adminPrisma);
    await removeRuntimeRole(adminPrisma);
    await runtimePrisma.$disconnect();
    await adminPrisma.$disconnect();
  }, 60_000);

  it("starts and resumes through a role that inherits only the onboarding consumer", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/onboarding/start",
      headers: authHeaders(actorUserId)
    });
    expect(start.statusCode).toBe(201);
    const started = JSON.parse(start.payload) as OrganizationOnboardingView;
    expect(started).toMatchObject({
      status: "IN_PROGRESS",
      organization: { lifecycle: "ONBOARDING" }
    });

    const current = await app.inject({
      method: "GET",
      url: "/onboarding/current",
      headers: authHeaders(actorUserId)
    });
    expect(current.statusCode).toBe(200);
    expect((JSON.parse(current.payload) as OnboardingAvailability).onboarding?.id).toBe(started.id);

    const otherActor = await app.inject({
      method: "GET",
      url: "/onboarding/current",
      headers: authHeaders(otherUserId)
    });
    expect(otherActor.statusCode).toBe(200);
    expect((JSON.parse(otherActor.payload) as OnboardingAvailability).onboarding).toBeNull();
  });

  it("has no elevated role, ownership or cross-tenant table visibility", async () => {
    const posture = await runtimePrisma.readPosture();
    expect(posture).toMatchObject({
      roleName: runtimeRole,
      canLogin: false,
      isSuperuser: false,
      bypassesRls: false,
      ownsBusinessTables: 0,
      isOnboardingConsumer: true,
      isOnboardingOwner: false,
      isContextConsumer: false
    });

    const onboarding = await adminPrisma.organizationOnboarding.findFirstOrThrow();
    expect(
      await runtimePrisma.countVisibleOnboardings(otherUserId, onboarding.organizationId)
    ).toBe(0);
  });
});

type RuntimePosture = {
  roleName: string;
  canLogin: boolean;
  isSuperuser: boolean;
  bypassesRls: boolean;
  ownsBusinessTables: number;
  isOnboardingConsumer: boolean;
  isOnboardingOwner: boolean;
  isContextConsumer: boolean;
};

class OnboardingRolePrismaService extends PrismaService {
  constructor() {
    super({ datasources: { db: { url: readTestDatabaseUrl() } } });
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
      await assumeRuntimeRole(tx);
      await setActorContext(tx, context.actorUserId || "", context.correlationId);
      return fn(tx);
    }, options);
  }

  readPosture() {
    return this.$transaction(async (tx) => {
      await assumeRuntimeRole(tx);
      const rows = await tx.$queryRawUnsafe<RuntimePosture[]>(
        "SELECT role.rolname AS \"roleName\", role.rolcanlogin AS \"canLogin\", role.rolsuper AS \"isSuperuser\", role.rolbypassrls AS \"bypassesRls\", (SELECT count(*)::integer FROM pg_catalog.pg_class AS business_table INNER JOIN pg_catalog.pg_namespace AS business_schema ON business_schema.oid = business_table.relnamespace WHERE business_schema.nspname = 'public' AND business_table.relkind IN ('r', 'p') AND business_table.relname <> '_prisma_migrations' AND business_table.relowner = role.oid) AS \"ownsBusinessTables\", pg_catalog.pg_has_role(role.oid, 'wefit_onboarding_consumer', 'MEMBER') AS \"isOnboardingConsumer\", pg_catalog.pg_has_role(role.oid, 'wefit_onboarding_owner', 'MEMBER') AS \"isOnboardingOwner\", pg_catalog.pg_has_role(role.oid, 'wefit_context_consumer', 'MEMBER') AS \"isContextConsumer\" FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user"
      );
      const posture = rows[0];
      if (!posture) {
        throw new Error("Restricted onboarding role posture is unavailable.");
      }
      return posture;
    });
  }

  countVisibleOnboardings(actorId: string, organizationId: string) {
    return this.$transaction(async (tx) => {
      await assumeRuntimeRole(tx);
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.actor_user_id', $1::text, true), set_config('app.organization_id', $2::text, true)",
        actorId,
        organizationId
      );
      const rows = await tx.$queryRawUnsafe<Array<{ count: number }>>(
        'SELECT count(*)::integer AS count FROM public."OrganizationOnboarding"'
      );
      return rows[0]?.count ?? 0;
    });
  }
}

async function setActorContext(
  tx: Prisma.TransactionClient,
  actorId: string,
  correlationId?: string
): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT set_config('app.organization_id', '', true), set_config('app.unit_id', '', true), set_config('app.actor_user_id', $1::text, true), set_config('app.correlation_id', $2::text, true)",
    actorId || "",
    correlationId || ""
  );
}

async function assumeRuntimeRole(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRawUnsafe('SET LOCAL ROLE "' + runtimeRole + '"');
}

async function provisionRuntimeRole(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '" +
      runtimeRole +
      "') THEN CREATE ROLE " +
      runtimeRole +
      " NOLOGIN; END IF; END $$;"
  );
  await prisma.$executeRawUnsafe(
    "ALTER ROLE " + runtimeRole + " NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS NOLOGIN"
  );
  await prisma.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO " + runtimeRole);
  await prisma.$executeRawUnsafe("GRANT wefit_onboarding_consumer TO " + runtimeRole);
  await prisma.$executeRawUnsafe(
    "REVOKE wefit_onboarding_owner, wefit_context_consumer, wefit_context_reader FROM " +
      runtimeRole
  );
  await prisma.$executeRawUnsafe(
    'GRANT SELECT ON public."OrganizationOnboarding", public."Organization", public."Unit", public."User" TO ' +
      runtimeRole
  );
}

async function removeRuntimeRole(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe("REVOKE wefit_onboarding_consumer FROM " + runtimeRole);
  await prisma.$executeRawUnsafe(
    "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM " + runtimeRole
  );
  await prisma.$executeRawUnsafe("REVOKE ALL PRIVILEGES ON SCHEMA public FROM " + runtimeRole);
  await prisma.$executeRawUnsafe("DROP ROLE IF EXISTS " + runtimeRole);
}

function authHeaders(userId: string) {
  return { "x-dev-user-id": userId };
}

function readTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is required for restricted onboarding tests.");
  }
  return databaseUrl;
}
