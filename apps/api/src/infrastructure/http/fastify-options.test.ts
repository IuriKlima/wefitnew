import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { loadApiEnv } from "@gym-platform/config";

import { createFastifyOptions } from "./fastify-options.js";

const apps: Array<ReturnType<typeof Fastify>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("trusted proxy Fastify configuration", () => {
  it("ignores X-Forwarded-For when the direct proxy is not trusted", async () => {
    const app = createIpApp("");

    const response = await app.inject({
      method: "GET",
      url: "/ip",
      remoteAddress: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.20" }
    });

    expect(response.json()).toEqual({ ip: "203.0.113.10" });
  });

  it("resolves the client IP only through an explicitly trusted proxy", async () => {
    const app = createIpApp("203.0.113.10");

    const response = await app.inject({
      method: "GET",
      url: "/ip",
      remoteAddress: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.20" }
    });

    expect(response.json()).toEqual({ ip: "198.51.100.20" });
  });

  it("keeps distinct client IPs for multiple users behind the same trusted proxy", async () => {
    const app = createIpApp("10.0.0.0/8");

    const [first, second] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/ip",
        remoteAddress: "10.10.0.5",
        headers: { "x-forwarded-for": "198.51.100.21" }
      }),
      app.inject({
        method: "GET",
        url: "/ip",
        remoteAddress: "10.10.0.5",
        headers: { "x-forwarded-for": "198.51.100.22" }
      })
    ]);

    expect(first.json()).toEqual({ ip: "198.51.100.21" });
    expect(second.json()).toEqual({ ip: "198.51.100.22" });
  });
});

function createIpApp(trustedProxies: string) {
  const env = loadApiEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/app",
    RATE_LIMIT_STORE: "memory",
    TRUSTED_PROXIES: trustedProxies,
    CORS_ORIGINS: "http://localhost:3000"
  });
  const app = Fastify(createFastifyOptions(env, false));
  app.get("/ip", (request) => ({ ip: request.ip }));
  apps.push(app);
  return app;
}
