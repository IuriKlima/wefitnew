import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";

import { RedisRateLimiter } from "../../src/common/rate-limit/redis-rate-limiter.js";
import { configureIntegrationTestEnv } from "../test-env.js";

configureIntegrationTestEnv();

describe("distributed Redis rate limiter integration", () => {
  const redisUrl = process.env.REDIS_URL!;
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const limiter = new RedisRateLimiter(redis);
  const cleanup = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const keys = new Set<string>();

  beforeAll(async () => {
    await cleanup.ping();
  });

  afterAll(async () => {
    if (keys.size > 0) {
      await cleanup.del(...[...keys].map((key) => `wefit:rate-limit:${key}`));
    }
    await redis.quit();
    await cleanup.quit();
  });

  it("enforces a shared limit atomically under concurrency", async () => {
    const key = createKey("concurrency");
    const decisions = await Promise.all(
      Array.from({ length: 30 }, () => limiter.consume({ key, limit: 7, ttlMs: 5_000 }))
    );

    expect(decisions.filter(({ allowed }) => allowed)).toHaveLength(7);
    expect(Math.max(...decisions.map(({ current }) => current))).toBe(30);
  });

  it("expires the distributed counter after the configured TTL", async () => {
    const key = createKey("expiration");
    const input = { key, limit: 1, ttlMs: 100 };

    expect((await limiter.consume(input)).allowed).toBe(true);
    expect((await limiter.consume(input)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await limiter.consume(input)).toMatchObject({ allowed: true, current: 1 });
  });

  function createKey(suffix: string): string {
    const key = `integration:${randomUUID()}:${suffix}`;
    keys.add(key);
    return key;
  }
});
