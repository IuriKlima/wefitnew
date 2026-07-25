import type { RateLimitDecision, RateLimitInput, RateLimiter } from "./rate-limiter.js";

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

export class MemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000
  ) {
    if (maxEntries < 1) {
      throw new Error("Memory rate limiter requires at least one entry.");
    }
  }

  async consume(input: RateLimitInput): Promise<RateLimitDecision> {
    assertRateLimitInput(input);

    const now = this.now();
    this.removeExpiredEntries(now);
    const existing = this.entries.get(input.key);

    if (!existing) {
      this.makeRoom();
      this.entries.set(input.key, { count: 1, expiresAt: now + input.ttlMs });
      return {
        allowed: true,
        current: 1,
        retryAfterMs: input.ttlMs
      };
    }

    existing.count += 1;
    return {
      allowed: existing.count <= input.limit,
      current: existing.count,
      retryAfterMs: Math.max(1, existing.expiresAt - now)
    };
  }

  get size(): number {
    return this.entries.size;
  }

  private removeExpiredEntries(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private makeRoom(): void {
    if (this.entries.size < this.maxEntries) {
      return;
    }

    let earliestKey: string | undefined;
    let earliestExpiration = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < earliestExpiration) {
        earliestKey = key;
        earliestExpiration = entry.expiresAt;
      }
    }

    if (earliestKey) {
      this.entries.delete(earliestKey);
    }
  }
}

function assertRateLimitInput(input: RateLimitInput): void {
  if (
    !input.key ||
    input.key.length > 512 ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    !Number.isSafeInteger(input.ttlMs) ||
    input.ttlMs < 1
  ) {
    throw new Error("Invalid rate limit input.");
  }
}
