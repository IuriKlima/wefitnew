import type Redis from "ioredis";
import { describe, expect, it, vi } from "vitest";

import { loadApiEnv } from "@gym-platform/config";

import { ManagedRedisConnection } from "./redis.service.js";

describe("managed Redis connection", () => {
  it("connects and pings Redis during bootstrap", async () => {
    const client = createRedisMock();
    const connection = createConnection(client);

    await connection.initialize();

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledOnce();
    expect(await connection.getReadiness()).toBe("ok");
  });

  it("fails bootstrap safely without exposing the Redis URL", async () => {
    const client = createRedisMock({
      connect: vi
        .fn()
        .mockRejectedValue(
          new Error("connect ECONNREFUSED redis://user:secret@redis.internal:6379")
        )
    });
    const connection = createConnection(client, "redis://user:secret@redis.internal:6379");

    await expect(connection.initialize()).rejects.toThrow("Redis is required but unavailable.");
    await expect(connection.initialize()).rejects.not.toThrow("secret");
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("times out a stalled Redis bootstrap and reports not ready", async () => {
    const client = createRedisMock({
      connect: vi.fn(() => new Promise<void>(() => undefined))
    });
    const connection = createConnection(client, "redis://localhost:6379", 100);

    await expect(connection.initialize()).rejects.toThrow("Redis is required but unavailable.");
    expect(await connection.getReadiness()).toBe("error");
  });

  it("reports Redis as not required for the bounded local memory store", async () => {
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      RATE_LIMIT_STORE: "memory",
      CORS_ORIGINS: "http://localhost:3000"
    });
    const factory = vi.fn();
    const connection = new ManagedRedisConnection(env, factory);

    await connection.initialize();

    expect(factory).not.toHaveBeenCalled();
    expect(await connection.getReadiness()).toBe("not_required");
  });
});

function createConnection(
  client: ReturnType<typeof createRedisMock>,
  redisUrl = "redis://localhost:6379",
  timeoutMs = 500
) {
  const env = loadApiEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/app",
    REDIS_URL: redisUrl,
    RATE_LIMIT_STORE: "redis",
    REDIS_CONNECT_TIMEOUT_MS: String(timeoutMs),
    REDIS_HEALTH_TIMEOUT_MS: String(timeoutMs),
    CORS_ORIGINS: "http://localhost:3000"
  });

  return new ManagedRedisConnection(env, () => client as unknown as Redis);
}

function createRedisMock(overrides: Partial<Redis> = {}) {
  const client = {
    status: "wait",
    on: vi.fn(),
    connect: vi.fn(async () => {
      client.status = "ready";
    }),
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue("OK"),
    disconnect: vi.fn(() => {
      client.status = "end";
    }),
    ...overrides
  };
  return client;
}
