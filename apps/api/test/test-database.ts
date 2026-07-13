import { createPrismaClient, type PrismaClient } from "@gym-platform/database";

import { configureIntegrationTestEnv } from "./test-env.js";

export function createTestPrismaClient(): PrismaClient {
  configureIntegrationTestEnv();

  return createPrismaClient(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL);
}

export async function assertDatabaseAvailable(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `PostgreSQL test database is unavailable. Run "pnpm docker:up" and "pnpm db:test:deploy" before integration tests. Original error: ${
        error instanceof Error ? error.message : "unknown"
      }`
    );
  }
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  assertSafeTestDatabaseUrl(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL);

  await prisma.auditLog.deleteMany();
  await prisma.studentUnit.deleteMany();
  await prisma.student.deleteMany();
  await prisma.organizationSubscription.deleteMany();
  await prisma.planFeature.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.membershipRole.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

export function assertSafeTestDatabaseUrl(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is required for integration tests.");
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (process.env.ALLOW_TEST_DATABASE_RESET !== "true" || !databaseName.endsWith("_test")) {
    throw new Error(`Refusing to reset unsafe database "${databaseName}".`);
  }
}
