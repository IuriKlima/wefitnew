import { describe, expect, it } from "vitest";

import { MemoryRateLimiter } from "./memory-rate-limiter.js";

describe("memory rate limiter", () => {
  it("enforces the limit and releases the key after its TTL", async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    const input = { key: "onboarding:start:actor", limit: 2, ttlMs: 500 };

    expect((await limiter.consume(input)).allowed).toBe(true);
    expect((await limiter.consume(input)).allowed).toBe(true);
    expect((await limiter.consume(input)).allowed).toBe(false);

    now += 500;
    expect(await limiter.consume(input)).toMatchObject({ allowed: true, current: 1 });
  });

  it("handles concurrent attempts without exceeding the configured allowance", async () => {
    const limiter = new MemoryRateLimiter();
    const decisions = await Promise.all(
      Array.from({ length: 20 }, () =>
        limiter.consume({ key: "onboarding:complete:actor", limit: 5, ttlMs: 60_000 })
      )
    );

    expect(decisions.filter(({ allowed }) => allowed)).toHaveLength(5);
    expect(Math.max(...decisions.map(({ current }) => current))).toBe(20);
  });

  it("bounds local memory and removes expired entries", async () => {
    let now = 10;
    const limiter = new MemoryRateLimiter(() => now, 2);

    await limiter.consume({ key: "first", limit: 1, ttlMs: 10 });
    await limiter.consume({ key: "second", limit: 1, ttlMs: 20 });
    await limiter.consume({ key: "third", limit: 1, ttlMs: 30 });
    expect(limiter.size).toBe(2);

    now = 100;
    await limiter.consume({ key: "fresh", limit: 1, ttlMs: 10 });
    expect(limiter.size).toBe(1);
  });
});
