import { describe, expect, it } from "vitest";

import { loadApiEnv, loadWorkerEnv, parseCorsOrigins, parseTrustedProxies } from "./api-env.js";

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
    expect(env.RATE_LIMIT_STORE).toBe("redis");
    expect(env.TRUSTED_PROXIES).toBe("");
    expect(parseCorsOrigins(env.CORS_ORIGINS)).toEqual([
      "http://localhost:3000",
      "http://localhost:3001"
    ]);
  });

  it("allows the bounded memory store only outside production", () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      RATE_LIMIT_STORE: "memory",
      CORS_ORIGINS: "http://localhost:3000"
    });

    expect(env.RATE_LIMIT_STORE).toBe("memory");
    expect(env.REDIS_URL).toBeUndefined();
  });

  it("requires Redis-backed rate limiting in production", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        AUTH_ADAPTER: "external",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        RATE_LIMIT_STORE: "memory",
        CORS_ORIGINS: "https://app.example.com"
      })
    ).toThrow("Production rate limiting must use Redis");
  });

  it("accepts only explicit trusted proxy IPs and CIDRs", () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      RATE_LIMIT_STORE: "memory",
      TRUSTED_PROXIES: "127.0.0.1, 10.0.0.0/8, 2001:db8::/32",
      CORS_ORIGINS: "http://localhost:3000"
    });

    expect(parseTrustedProxies(env.TRUSTED_PROXIES)).toEqual([
      "127.0.0.1",
      "10.0.0.0/8",
      "2001:db8::/32"
    ]);
  });

  it.each(["*", "0.0.0.0/0", "::/0"])(
    "rejects the trusted proxy wildcard %s in production",
    (trustedProxy) => {
      expect(() =>
        loadApiEnv({
          NODE_ENV: "production",
          AUTH_ADAPTER: "external",
          DATABASE_URL: "postgresql://user:password@localhost:5432/app",
          REDIS_URL: "redis://localhost:6379",
          TRUSTED_PROXIES: trustedProxy,
          CORS_ORIGINS: "https://app.example.com"
        })
      ).toThrow("Wildcard trusted proxies are not allowed");
    }
  );

  it("rejects hostnames and malformed trusted proxy entries", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        RATE_LIMIT_STORE: "memory",
        TRUSTED_PROXIES: "proxy.internal,10.0.0.0/99",
        CORS_ORIGINS: "http://localhost:3000"
      })
    ).toThrow("Invalid trusted proxy entry");
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
