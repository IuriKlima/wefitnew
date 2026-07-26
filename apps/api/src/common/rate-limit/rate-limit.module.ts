import { Module } from "@nestjs/common";

import { RedisModule } from "../../infrastructure/redis/redis.module.js";
import { RedisService } from "../../infrastructure/redis/redis.service.js";
import { MemoryRateLimiter } from "./memory-rate-limiter.js";
import { RATE_LIMITER, type RateLimiter } from "./rate-limiter.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";

@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: RATE_LIMITER,
      inject: [RedisService],
      useFactory(redisService: RedisService): RateLimiter {
        const redis = redisService.getClient();
        if (redis) {
          return new RedisRateLimiter(redis);
        }
        return new MemoryRateLimiter();
      }
    }
  ],
  exports: [RATE_LIMITER]
})
export class RateLimitModule {}
