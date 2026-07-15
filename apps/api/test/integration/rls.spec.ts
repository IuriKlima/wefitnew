import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@gym-platform/database";
import { randomUUID } from "crypto";
import { PrismaService } from "../../src/infrastructure/database/prisma.service";

describe("Row Level Security (RLS) - Integration", () => {
  let adminClient: PrismaClient;
  let prismaService: PrismaService;
  
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const unitA1 = randomUUID();
  const unitB1 = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  beforeAll(async () => {
    console.log("Starting beforeAll hook");
    // Admin client bypasses RLS (since gym_platform is superuser in docker)
    adminClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || "postgresql://gym_platform:gym_platform_test_password@localhost:55432/gym_platform_test?schema=public",
        },
      },
    });
    console.log("adminClient initialized");

    console.log("Killing other connections...");
    // Kill all other connections to avoid locking issues with ALTER TABLE
    await adminClient.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'gym_platform_test' AND pid <> pg_backend_pid();
    `);
    console.log("Other connections killed.");

    console.log("Creating wefit_api_test role...");
    // Create a non-superuser role to act as the API, since gym_platform is a superuser
    await adminClient.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wefit_api_test') THEN
          CREATE ROLE wefit_api_test WITH LOGIN PASSWORD 'testpassword';
        END IF;
      END
      $$;
    `);
    console.log("Granting privileges to wefit_api_test role...");
    await adminClient.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wefit_api_test;`);
    await adminClient.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO wefit_api_test;`);
    // Ensure it can use sequences and functions
    await adminClient.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wefit_api_test;`);
    await adminClient.$executeRawUnsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO wefit_api_test;`);
    console.log("Privileges granted.");

    console.log("Initializing prismaService...");
    prismaService = new PrismaService({
      datasources: {
        db: {
          url: "postgresql://wefit_api_test:testpassword@localhost:55432/gym_platform_test?schema=public",
        },
      },
    });
    console.log("prismaService initialized.");

    console.log("Seeding data...");
    // Seed Data (gym_platform can insert before RLS is enabled)
    await adminClient.$transaction(async (tx) => {
      
      await tx.organization.createMany({
        data: [
          { id: tenantA, type: "NETWORK", slug: tenantA, legalName: "Tenant A" },
          { id: tenantB, type: "GYM", slug: tenantB, legalName: "Tenant B" },
        ],
      });

      await tx.unit.createMany({
        data: [
          { id: unitA1, organizationId: tenantA, name: "Unit A1", code: "A1" },
          { id: unitB1, organizationId: tenantB, name: "Unit B1", code: "B1" },
        ],
      });

      await tx.user.createMany({
        data: [
          { id: userA, name: "User A", email: `${userA}@test.com` },
          { id: userB, name: "User B", email: `${userB}@test.com` },
        ],
      });

      const membershipA = randomUUID();
      const membershipB = randomUUID();

      await tx.membership.createMany({
        data: [
          { id: membershipA, organizationId: tenantA, userId: userA, status: "ACTIVE" },
          { id: membershipB, organizationId: tenantB, userId: userB, status: "ACTIVE" },
        ],
      });

      const roleA = randomUUID();
      const roleB = randomUUID();

      await tx.role.createMany({
        data: [
          { id: roleA, organizationId: tenantA, key: "owner_a", name: "Owner A", isSystem: false },
          { id: roleB, organizationId: tenantB, key: "owner_b", name: "Owner B", isSystem: false },
        ]
      });

      await tx.membershipRole.createMany({
        data: [
          { id: randomUUID(), organizationId: tenantA, membershipId: membershipA, roleId: roleA, unitId: null },
          { id: randomUUID(), organizationId: tenantB, membershipId: membershipB, roleId: roleB, unitId: null },
        ]
      });
    });
    console.log("Data seeded.");

    console.log("Enabling RLS...");
    // Enable RLS for this test suite
    const tables = [
      "Organization", "Unit", "Membership", "Role", "MembershipRole",
      "RolePermission", "OrganizationSubscription", "Student", "StudentUnit", "AuditLog"
    ];
    for (const table of tables) {
      await adminClient.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await adminClient.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    }
    console.log("RLS enabled.");
  }, 60000);

  afterAll(async () => {
    // Disable RLS
    const tables = [
      "Organization", "Unit", "Membership", "Role", "MembershipRole",
      "RolePermission", "OrganizationSubscription", "Student", "StudentUnit", "AuditLog"
    ];
    for (const table of tables) {
      await adminClient.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
    }
    
    await adminClient.$transaction(async (tx) => {
      await tx.membershipRole.deleteMany({ where: { organizationId: { in: [tenantA, tenantB] } } });
      await tx.role.deleteMany({ where: { organizationId: { in: [tenantA, tenantB] } } });
      await tx.membership.deleteMany({ where: { organizationId: { in: [tenantA, tenantB] } } });
      await tx.unit.deleteMany({ where: { organizationId: { in: [tenantA, tenantB] } } });
      await tx.organization.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await tx.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    });
    
    await prismaService.$disconnect();
    await prismaService.$disconnect();
    await adminClient.$disconnect();
  });

  it("1. Falha em contexto inválido (sem set_config)", async () => {
    // Should return 0 rows if RLS is enforced and we are not the owner
    const units = await prismaService.unit.findMany();
    // Wait, since we connect as wefit_api, RLS applies. Since no context is set, it returns 0 rows.
    expect(units.length).toBe(0);
  });

  it("2. Isolamento entre tenants A e B (Leitura)", async () => {
    await prismaService.withTenantContext(
      { organizationId: tenantA, actorUserId: userA },
      async (tx) => {
        const orgs = await tx.organization.findMany();
        expect(orgs.length).toBeGreaterThan(0);
        expect(orgs.some(o => o.id === tenantB)).toBe(false);
      }
    );
  });

  it("3. Unit escalation", async () => {
    await prismaService.withTenantContext(
      { organizationId: tenantA, unitId: unitA1, actorUserId: userA },
      async (tx) => {
        const units = await tx.unit.findMany();
        expect(units.some(u => u.id !== unitA1)).toBe(false);
      }
    );
  });
  
  it("4. Escrita vazada falha (Insert cross-tenant)", async () => {
    await expect(
      prismaService.withTenantContext(
        { organizationId: tenantA, actorUserId: userA },
        async (tx) => {
          await tx.unit.create({
            data: {
              id: randomUUID(),
              organizationId: tenantB,
              name: "Hacked Unit",
              code: "HACK",
            }
          });
        }
      )
    ).rejects.toThrow();
  });
});
