import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { PrismaClient } from "@gym-platform/database";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
