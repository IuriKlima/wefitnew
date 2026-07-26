import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service.js";
import { RedisService } from "../../infrastructure/redis/redis.service.js";

type DependencyReadiness = "ok" | "error";

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService
  ) {}

  getLive() {
    return {
      status: "ok",
      service: "api",
      check: "live",
      timestamp: new Date().toISOString()
    };
  }

  async getReady() {
    const [postgres, redis] = await Promise.all([
      this.getPostgresReadiness(),
      this.redis.getReadiness()
    ]);
    const payload = {
      status: postgres === "ok" && redis !== "error" ? "ok" : "error",
      service: "api",
      check: "ready",
      dependencies: {
        postgres,
        redis
      },
      timestamp: new Date().toISOString()
    };

    if (payload.status === "error") {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  private async getPostgresReadiness(): Promise<DependencyReadiness> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "ok";
    } catch {
      return "error";
    }
  }
}
