const defaultTestDatabaseUrl =
  "postgresql://gym_platform:gym_platform_test_password@localhost:55432/gym_platform_test?schema=public";

export function configureUnitTestEnv(): void {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??= defaultTestDatabaseUrl;
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.CORS_ORIGINS ??= "http://localhost:3000";
  process.env.SWAGGER_ENABLED ??= "false";
  process.env.RATE_LIMIT_MAX ??= "1000";
  process.env.AUTH_ADAPTER ??= "temporary-header";
  process.env.ORGANIZATION_SELF_SERVICE_ENABLED ??= "false";
}

export function configureIntegrationTestEnv(): void {
  configureUnitTestEnv();
  process.env.DATABASE_URL_TEST ??= defaultTestDatabaseUrl;
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.ALLOW_TEST_DATABASE_RESET = "true";
  process.env.ORGANIZATION_SELF_SERVICE_ENABLED = "true";
}
