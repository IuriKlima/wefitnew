import { describe, expect, it } from "vitest";

import { loadApiEnv, loadWorkerEnv, parseCorsOrigins } from "./api-env.js";

describe("api env validation", () => {
  it("loads a valid configuration", () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379",
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3001"
    });

    expect(env.PORT).toBe(3333);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.AUTH_ADAPTER).toBe("temporary-header");
    expect(env.ORGANIZATION_SELF_SERVICE_ENABLED).toBe(false);
    expect(parseCorsOrigins(env.CORS_ORIGINS)).toEqual([
      "http://localhost:3000",
      "http://localhost:3001"
    ]);
  });

  it("rejects missing required connection strings", () => {
    expect(() => loadApiEnv({ NODE_ENV: "test" })).toThrow();
  });

  it("rejects temporary auth in production", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        AUTH_ADAPTER: "temporary-header",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGINS: "https://app.example.com"
      })
    ).toThrow();
  });

  it("disables organization self-service by default in production", () => {
    const env = loadApiEnv({
      NODE_ENV: "production",
      AUTH_ADAPTER: "external",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379",
      CORS_ORIGINS: "https://app.example.com"
    });

    expect(env.ORGANIZATION_SELF_SERVICE_ENABLED).toBe(false);
  });

  it("rejects organization self-service explicitly enabled in production", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        AUTH_ADAPTER: "external",
        ORGANIZATION_SELF_SERVICE_ENABLED: "true",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGINS: "https://app.example.com"
      })
    ).toThrow();
  });

  it("rejects wildcard CORS when credentials are enabled", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        AUTH_ADAPTER: "external",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGINS: "*"
      })
    ).toThrow();
  });

  it("rejects supabase-jwt adapter if SUPABASE_URL or SUPABASE_JWKS_URL are missing", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "test",
        AUTH_ADAPTER: "supabase-jwt",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGINS: "http://localhost:3000"
      })
    ).toThrow();
  });

  it("accepts supabase-jwt adapter if both Supabase configs are present", () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      AUTH_ADAPTER: "supabase-jwt",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379",
      CORS_ORIGINS: "http://localhost:3000",
      SUPABASE_URL: "https://foo.supabase.co",
      SUPABASE_JWKS_URL: "https://foo.supabase.co/auth/v1/.well-known/jwks.json"
    });

    expect(env.AUTH_ADAPTER).toBe("supabase-jwt");
  });

  it("loads worker env without API-only variables", () => {
    expect(
      loadWorkerEnv({
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379"
      }).REDIS_URL
    ).toBe("redis://localhost:6379");
  });

  it("accepts an authenticated Redis TLS URL for workers", () => {
    expect(
      loadWorkerEnv({
        NODE_ENV: "production",
        REDIS_URL: "rediss://worker:password@redis.example.com:6380"
      }).REDIS_URL
    ).toBe("rediss://worker:password@redis.example.com:6380");
  });
});
