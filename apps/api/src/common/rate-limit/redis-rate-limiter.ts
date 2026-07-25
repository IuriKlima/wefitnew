import type { OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import type { RateLimitDecision, RateLimitInput, RateLimiter } from "./rate-limiter.js";

const consumeScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export class RedisRateLimiter implements RateLimiter, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1
    });
    this.redis.on("error", () => undefined);
  }

  async consume(input: RateLimitInput): Promise<RateLimitDecision> {
    const result = await this.redis.eval(
      consumeScript,
      1,
      `wefit:rate-limit:${input.key}`,
      input.ttlMs
    );
    const [currentValue, ttlValue] = readRedisResult(result);
    const retryAfterMs = Math.max(1, ttlValue);

    return {
      allowed: currentValue <= input.limit,
      current: currentValue,
      retryAfterMs
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (["wait", "connecting", "reconnecting"].includes(this.redis.status)) {
      this.redis.disconnect();
      return;
    }

    if (this.redis.status !== "end") {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }
}

function readRedisResult(result: unknown): [number, number] {
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    typeof result[0] !== "number" ||
    typeof result[1] !== "number"
  ) {
    throw new Error("Redis returned an invalid rate limit result.");
  }

  return [result[0], result[1]];
}
