import { Module } from "@nestjs/common";

import { loadApiEnv } from "@gym-platform/config";

import { MemoryRateLimiter } from "./memory-rate-limiter.js";
import { RATE_LIMITER, type RateLimiter } from "./rate-limiter.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";

@Module({
  providers: [
    {
      provide: RATE_LIMITER,
      useFactory(): RateLimiter {
        const env = loadApiEnv();
        if (env.RATE_LIMIT_STORE === "redis") {
          return new RedisRateLimiter(env.REDIS_URL!);
        }
        return new MemoryRateLimiter();
      }
    }
  ],
  exports: [RATE_LIMITER]
})
export class RateLimitModule {}
