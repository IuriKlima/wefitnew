import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestApp } from "../test-app.js";
import { configureUnitTestEnv } from "../test-env.js";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  check: z.literal("live"),
  timestamp: z.string()
});

configureUnitTestEnv();

describe("public health and authentication guard", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns public liveness status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/live"
    });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(JSON.parse(response.payload)).status).toBe("ok");
  });

  it("returns 401 without a temporary actor on private endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/organizations/11111111-1111-4111-8111-111111111111/units/22222222-2222-4222-8222-222222222222"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 without authentication on the account context endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me/context"
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for an invalid temporary actor on the account context endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/me/context",
      headers: {
        "x-dev-user-id": "not-a-uuid"
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("replaces invalid incoming correlation IDs", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: {
        "x-correlation-id": "invalid value with spaces and more than we trust"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-correlation-id"]).not.toBe(
      "invalid value with spaces and more than we trust"
    );
    expect(z.string().uuid().parse(response.headers["x-correlation-id"])).toBeDefined();
  });
});
