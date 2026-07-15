import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { Prisma, PrismaClient } from "@gym-platform/database";

export interface TenantContext {
  organizationId: string;
  unitId?: string;
  actorUserId?: string;
  correlationId?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTenantContext<T>(
    context: TenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.organization_id', ${context.organizationId}, true),
          set_config('app.unit_id', ${context.unitId || ""}, true),
          set_config('app.actor_user_id', ${context.actorUserId || ""}, true),
          set_config('app.correlation_id', ${context.correlationId || ""}, true)
      `;
      return fn(tx);
    }, options);
  }
}
