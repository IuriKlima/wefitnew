import { Inject, Injectable } from "@nestjs/common";

import { hasPermission, type PermissionKey } from "@gym-platform/permissions";

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
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        status: "ACTIVE",
        deletedAt: null
      },
      include: {
        membershipRoles: {
          where: {
            organizationId: input.organizationId
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!membership) {
      return false;
    }

    const assignments = membership.membershipRoles.flatMap((membershipRole) =>
      membershipRole.role.rolePermissions.map((rolePermission) => ({
        permission: rolePermission.permission.key,
        unitId: membershipRole.unitId
      }))
    );

    return hasPermission(
      assignments,
      input.permission,
      input.unitId ? { unitId: input.unitId } : {}
    );
  }
}
