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

  it("loads worker env without API-only variables", () => {
    expect(
      loadWorkerEnv({
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379"
      }).REDIS_URL
    ).toBe("redis://localhost:6379");
  });
});
