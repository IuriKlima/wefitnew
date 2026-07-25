import type Redis from "ioredis";

import type { RateLimitDecision, RateLimitInput, RateLimiter } from "./rate-limiter.js";

const consumeScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Pick<Redis, "eval">) {}

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
