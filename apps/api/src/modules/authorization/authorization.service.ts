import { Inject, Injectable } from "@nestjs/common";

import type { PermissionKey } from "@gym-platform/permissions";

import { PrismaService } from "../../infrastructure/database/prisma.service.js";

type AuthorizationInput = {
  userId: string;
  organizationId: string;
  permission: PermissionKey | string;
  unitId?: string;
};

@Injectable()
export class AuthorizationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async can(input: AuthorizationInput): Promise<boolean> {
    return this.prisma.canInTenantContext({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      permission: input.permission,
      ...(input.unitId ? { unitId: input.unitId } : {})
    });
  }
}
