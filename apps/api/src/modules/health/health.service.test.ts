import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/database/prisma.service.js";
import type { RedisService } from "../../infrastructure/redis/redis.service.js";
import { HealthService } from "./health.service.js";

describe("health readiness", () => {
  it("reports PostgreSQL and Redis as ready", async () => {
    const service = createHealthService("ok");

    await expect(service.getReady()).resolves.toMatchObject({
      status: "ok",
      dependencies: {
        postgres: "ok",
        redis: "ok"
      }
    });
  });

  it("reports memory-backed local mode without requiring Redis", async () => {
    const service = createHealthService("not_required");

    await expect(service.getReady()).resolves.toMatchObject({
      status: "ok",
      dependencies: {
        postgres: "ok",
        redis: "not_required"
      }
    });
  });

  it("changes readiness to unavailable when Redis fails", async () => {
    const service = createHealthService("error");

    const error = await service.getReady().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: "error",
      dependencies: {
        postgres: "ok",
        redis: "error"
      }
    });
  });

  it("changes readiness to unavailable when PostgreSQL fails", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("database unavailable"))
    } as unknown as PrismaService;
    const redis = {
      getReadiness: vi.fn().mockResolvedValue("ok")
    } as unknown as RedisService;
    const service = new HealthService(prisma, redis);

    const error = await service.getReady().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: "error",
      dependencies: {
        postgres: "error",
        redis: "ok"
      }
    });
  });
});

function createHealthService(redisStatus: "ok" | "not_required" | "error") {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }])
  } as unknown as PrismaService;
  const redis = {
    getReadiness: vi.fn().mockResolvedValue(redisStatus)
  } as unknown as RedisService;

  return new HealthService(prisma, redis);
}
