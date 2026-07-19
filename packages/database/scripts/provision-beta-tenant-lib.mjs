import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

export const ownerPermissionKeys = [
  "organization:read",
  "organization:manage",
  "unit:read",
  "unit:manage",
  "student:read",
  "student:manage",
  "membership:manage",
  "subscription:read",
  "audit:read"
];

const environmentPattern = /^(beta|staging|production)$/;
const allowedDatabaseSslModes = new Set(["require", "verify-ca", "verify-full"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseProvisionConfig(env, argv = []) {
  const environment = required(env.BETA_PROVISION_ENV, "BETA_PROVISION_ENV");
  if (!environmentPattern.test(environment)) {
    throw new Error("BETA_PROVISION_ENV must be beta, staging, or production.");
  }

  const databaseUrl = required(env.BETA_PROVISION_DATABASE_URL, "BETA_PROVISION_DATABASE_URL");
  const databaseName = getDatabaseName(databaseUrl);
  const databaseSslMode = new URL(databaseUrl).searchParams.get("sslmode");
  if (!allowedDatabaseSslModes.has(databaseSslMode ?? "")) {
    throw new Error("BETA_PROVISION_DATABASE_URL must require TLS with an approved sslmode.");
  }
  const expectedDatabase = required(
    env.BETA_PROVISION_EXPECTED_DATABASE,
    "BETA_PROVISION_EXPECTED_DATABASE"
  );

  if (databaseName !== expectedDatabase || !databaseName.endsWith(`_${environment}`)) {
    throw new Error("Administrative DSN database does not match the declared environment.");
  }

  const actorUserId = required(env.BETA_PROVISION_ACTOR_USER_ID, "BETA_PROVISION_ACTOR_USER_ID");
  if (!uuidPattern.test(actorUserId)) {
    throw new Error("BETA_PROVISION_ACTOR_USER_ID must be a UUID.");
  }

  const slug = required(env.BETA_PROVISION_ORGANIZATION_SLUG, "BETA_PROVISION_ORGANIZATION_SLUG");
  if (!slugPattern.test(slug) || slug.length > 80) {
    throw new Error("BETA_PROVISION_ORGANIZATION_SLUG is invalid.");
  }

  const createUser = env.BETA_PROVISION_CREATE_USER === "true";
  const dryRun = argv.includes("--dry-run") || env.BETA_PROVISION_DRY_RUN === "true";

  if (!dryRun && env.BETA_PROVISION_CONFIRM !== slug) {
    throw new Error("Set BETA_PROVISION_CONFIRM exactly to BETA_PROVISION_ORGANIZATION_SLUG.");
  }

  const config = {
    environment,
    databaseUrl,
    databaseName,
    actorUserId,
    createUser,
    dryRun,
    organization: {
      id: randomUUID(),
      type: required(env.BETA_PROVISION_ORGANIZATION_TYPE, "BETA_PROVISION_ORGANIZATION_TYPE"),
      legalName: required(
        env.BETA_PROVISION_ORGANIZATION_LEGAL_NAME,
        "BETA_PROVISION_ORGANIZATION_LEGAL_NAME"
      ),
      tradeName: emptyToUndefined(env.BETA_PROVISION_ORGANIZATION_TRADE_NAME),
      slug,
      unitName: required(env.BETA_PROVISION_DEFAULT_UNIT_NAME, "BETA_PROVISION_DEFAULT_UNIT_NAME")
    },
    user: {
      name: createUser
        ? required(env.BETA_PROVISION_ACTOR_NAME, "BETA_PROVISION_ACTOR_NAME")
        : undefined,
      email: createUser
        ? required(env.BETA_PROVISION_ACTOR_EMAIL, "BETA_PROVISION_ACTOR_EMAIL").toLowerCase()
        : undefined
    }
  };

  if (!new Set(["PERSONAL", "GYM", "NETWORK"]).has(config.organization.type)) {
    throw new Error("BETA_PROVISION_ORGANIZATION_TYPE is invalid.");
  }

  if (config.organization.legalName.length > 160 || config.organization.unitName.length > 120) {
    throw new Error("Organization or default unit name exceeds its allowed length.");
  }

  if (config.user.email && (config.user.email.length > 254 || !config.user.email.includes("@"))) {
    throw new Error("BETA_PROVISION_ACTOR_EMAIL is invalid.");
  }

  return config;
}

export async function assertAdministrativeRole(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT current_user AS role_name, r.rolsuper AS is_superuser, r.rolbypassrls AS bypasses_rls
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = current_user
  `;
  const role = rows[0];

  if (!role || (!role.is_superuser && !role.bypasses_rls)) {
    throw new Error(
      "Administrative DSN must use a role that can provision with FORCE RLS enabled."
    );
  }
}

export async function provisionBetaTenant(prisma, config) {
  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { id: config.actorUserId },
      select: { id: true, deletedAt: true }
    });

    let createdUser = false;
    if (!user) {
      if (!config.createUser) {
        throw new Error(
          "Actor User does not exist; set BETA_PROVISION_CREATE_USER=true to create it."
        );
      }

      user = await tx.user.create({
        data: {
          id: config.actorUserId,
          name: config.user.name,
          email: config.user.email
        },
        select: { id: true, deletedAt: true }
      });
      createdUser = true;
    }

    if (user.deletedAt) {
      throw new Error("Actor User is archived and cannot own a beta tenant.");
    }

    const existing = await tx.organization.findUnique({
      where: { slug: config.organization.slug },
      select: {
        id: true,
        type: true,
        legalName: true,
        tradeName: true,
        deletedAt: true
      }
    });

    if (existing?.deletedAt) {
      throw new Error("An archived organization already uses this slug.");
    }

    if (existing) {
      await assertExistingProvision(tx, existing, config);
      return {
        organizationId: existing.id,
        created: false,
        createdUser: false
      };
    }

    const organization = await tx.organization.create({
      data: {
        id: config.organization.id,
        type: config.organization.type,
        legalName: config.organization.legalName,
        tradeName: config.organization.tradeName ?? null,
        slug: config.organization.slug
      }
    });

    const unit = await tx.unit.create({
      data: {
        organizationId: organization.id,
        name: config.organization.unitName,
        code: "MAIN"
      }
    });

    for (const key of ownerPermissionKeys) {
      await tx.permission.upsert({
        where: { key },
        create: { key, description: `Allows ${key}.` },
        update: {}
      });
    }

    const ownerRole = await tx.role.create({
      data: {
        organizationId: organization.id,
        key: "owner",
        name: "Owner",
        description: "Initial owner provisioned by the closed beta tool.",
        isSystem: true
      }
    });

    const permissions = await tx.permission.findMany({
      where: { key: { in: ownerPermissionKeys } },
      select: { id: true }
    });

    if (permissions.length !== ownerPermissionKeys.length) {
      throw new Error("Permission catalog could not be resolved completely.");
    }

    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        organizationId: organization.id,
        roleId: ownerRole.id,
        permissionId: permission.id
      }))
    });

    const membership = await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        status: "ACTIVE"
      }
    });

    await tx.membershipRole.create({
      data: {
        organizationId: organization.id,
        membershipId: membership.id,
        roleId: ownerRole.id,
        unitId: null
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        unitId: unit.id,
        actorUserId: user.id,
        action: "organization.provisioned",
        entity: "Organization",
        entityId: organization.id,
        metadata: {
          channel: "closed-beta",
          environment: config.environment
        }
      }
    });

    return {
      organizationId: organization.id,
      created: true,
      createdUser
    };
  });
}

async function assertExistingProvision(tx, organization, config) {
  if (
    organization.type !== config.organization.type ||
    organization.legalName !== config.organization.legalName ||
    (organization.tradeName ?? undefined) !== config.organization.tradeName
  ) {
    throw new Error("Existing organization does not match the declared closed-beta tenant.");
  }

  const organizationId = organization.id;
  const [unit, membership, ownerRole] = await Promise.all([
    tx.unit.findFirst({
      where: { organizationId, code: "MAIN", deletedAt: null },
      select: { id: true, name: true }
    }),
    tx.membership.findFirst({
      where: {
        organizationId,
        userId: config.actorUserId,
        status: "ACTIVE",
        deletedAt: null
      },
      select: { id: true }
    }),
    tx.role.findFirst({
      where: { organizationId, key: "owner" },
      select: { id: true }
    })
  ]);

  if (!unit || !membership || !ownerRole) {
    throw new Error("Existing organization is not a complete closed-beta provision.");
  }

  if (unit.name !== config.organization.unitName) {
    throw new Error("Existing default unit does not match the declared closed-beta tenant.");
  }

  const [assignment, permissionCount, auditLog] = await Promise.all([
    tx.membershipRole.findFirst({
      where: { organizationId, membershipId: membership.id, roleId: ownerRole.id, unitId: null },
      select: { id: true }
    }),
    tx.rolePermission.count({
      where: {
        organizationId,
        roleId: ownerRole.id,
        permission: { key: { in: ownerPermissionKeys } }
      }
    }),
    tx.auditLog.findFirst({
      where: {
        organizationId,
        actorUserId: config.actorUserId,
        action: "organization.provisioned",
        entity: "Organization",
        entityId: organizationId
      },
      select: { id: true }
    })
  ]);

  if (!assignment || permissionCount !== ownerPermissionKeys.length || !auditLog) {
    throw new Error("Existing organization is missing owner permissions or provisioning audit.");
  }
}

function required(value, name) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function emptyToUndefined(value) {
  return value?.trim() || undefined;
}

function getDatabaseName(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("BETA_PROVISION_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!parsed.protocol.startsWith("postgres")) {
    throw new Error("BETA_PROVISION_DATABASE_URL must use PostgreSQL.");
  }

  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!name) {
    throw new Error("BETA_PROVISION_DATABASE_URL must include a database name.");
  }

  return name;
}

async function main() {
  const config = parseProvisionConfig(process.env, process.argv.slice(2));
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });

  try {
    await assertAdministrativeRole(prisma);

    if (config.dryRun) {
      console.log(
        JSON.stringify({
          dryRun: true,
          environment: config.environment,
          database: config.databaseName,
          organizationSlug: config.organization.slug,
          createsUserIfMissing: config.createUser
        })
      );
      return;
    }

    const result = await provisionBetaTenant(prisma, config);
    console.log(
      JSON.stringify({
        environment: config.environment,
        database: config.databaseName,
        organizationId: result.organizationId,
        created: result.created,
        createdUser: result.createdUser
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Closed beta provisioning failed.");
    process.exitCode = 1;
  });
}
