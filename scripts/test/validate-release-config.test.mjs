import assert from "node:assert/strict";
import test from "node:test";

import { validateReleaseConfig } from "../validate-release-config.mjs";

function createValidEnv() {
  return {
    RELEASE_ENV: "staging",
    NODE_ENV: "production",
    AUTH_ADAPTER: "supabase-jwt",
    ADMIN_AUTH_ADAPTER: "supabase-jwt",
    SWAGGER_ENABLED: "false",
    ORGANIZATION_SELF_SERVICE_ENABLED: "false",
    NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED: "false",
    RATE_LIMIT_MAX: "100",
    LOG_LEVEL: "info",
    DATABASE_URL:
      "postgresql://runtime:password@database.staging.internal:5432/gym?sslmode=require",
    REDIS_URL: "rediss://worker:password@redis.staging.internal:6380",
    CORS_ORIGINS: "https://admin.staging.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_JWKS_URL: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    ADMIN_API_BASE_URL: "http://api:3333",
    RELEASE_API_URL: "https://api.staging.example.com",
    RELEASE_ADMIN_WEB_URL: "https://admin.staging.example.com"
  };
}

test("accepts a safe staging configuration", () => {
  assert.deepEqual(validateReleaseConfig(createValidEnv()), []);
});

test("rejects temporary authentication and unsafe flags", () => {
  const env = {
    ...createValidEnv(),
    AUTH_ADAPTER: "temporary-header",
    ADMIN_AUTH_ADAPTER: "temporary-header",
    SWAGGER_ENABLED: "true",
    ORGANIZATION_SELF_SERVICE_ENABLED: "true",
    NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED: "true",
    ADMIN_DEV_USER_ID: "11111111-1111-4111-8111-111111111111",
    ADMIN_ORGANIZATION_ID: "22222222-2222-4222-8222-222222222222",
    ADMIN_UNIT_ID: "33333333-3333-4333-8333-333333333333"
  };

  assert.deepEqual(validateReleaseConfig(env), [
    "AUTH_ADAPTER must be supabase-jwt; temporary authentication is not allowed.",
    "ADMIN_AUTH_ADAPTER must be supabase-jwt.",
    "SWAGGER_ENABLED must be false for a release deployment.",
    "ORGANIZATION_SELF_SERVICE_ENABLED must be false for a release deployment.",
    "NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED must be false for a release deployment.",
    "ADMIN_DEV_USER_ID must not be configured for a release deployment.",
    "ADMIN_ORGANIZATION_ID must not be configured; release context comes from /me/context.",
    "ADMIN_UNIT_ID must not be configured; release context comes from /me/context."
  ]);
});

test("rejects insecure origins and plaintext Redis", () => {
  const env = {
    ...createValidEnv(),
    CORS_ORIGINS: "http://admin.staging.example.com,*",
    REDIS_URL: "redis://redis.staging.internal:6379"
  };

  assert.deepEqual(validateReleaseConfig(env), [
    "REDIS_URL must use an allowed protocol.",
    "REDIS_URL must include username and password.",
    "CORS_ORIGINS must contain HTTPS origins only.",
    "CORS_ORIGINS cannot contain an empty value or wildcard."
  ]);
});

test("rejects an unsafe database connection and inconsistent JWKS settings", () => {
  const env = {
    ...createValidEnv(),
    DATABASE_URL: "postgresql://runtime:password@database.staging.internal:5432/gym",
    SUPABASE_JWKS_URL: "https://other.supabase.co/auth/v1/.well-known/jwks.json"
  };

  assert.deepEqual(validateReleaseConfig(env), [
    "DATABASE_URL must require TLS with an approved sslmode.",
    "SUPABASE_JWKS_URL must use the expected JWKS endpoint on SUPABASE_URL."
  ]);
});
