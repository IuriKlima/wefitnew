import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service.js";

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getLive() {
    return {
      status: "ok",
      service: "api",
      check: "live",
      timestamp: new Date().toISOString()
    };
  }

  async getReady() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "api",
      check: "ready",
      dependencies: {
        postgres: "ok"
      },
      timestamp: new Date().toISOString()
    };
  }
}
