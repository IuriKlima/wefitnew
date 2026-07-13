import { Inject, Injectable } from "@nestjs/common";

import { listDefaultOwnerPermissions } from "@gym-platform/permissions";
import type { CreateOrganizationInput } from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import type { CreatedOrganizationResult } from "../domain/organization.js";

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createWithDefaultUnit(
    input: CreateOrganizationInput,
    actorUserId: string,
    correlationId: string
  ): Promise<CreatedOrganizationResult> {
    return this.prisma.$transaction(async (transaction) => {
      const actor = await transaction.user.findFirst({
        where: {
          id: actorUserId,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!actor) {
        throw new DomainError("Authenticated user not found.", "AUTHENTICATED_USER_NOT_FOUND", 403);
      }

      const organization = await transaction.organization.create({
        data: {
          type: input.type,
          legalName: input.legalName,
          tradeName: input.tradeName ?? null,
          slug: input.slug
        }
      });

      const defaultUnit = await transaction.unit.create({
        data: {
          organizationId: organization.id,
          name: input.defaultUnitName ?? "Unidade principal",
          code: "MAIN"
        }
      });

      const ownerPermissionKeys = listDefaultOwnerPermissions();

      for (const permissionKey of ownerPermissionKeys) {
        await transaction.permission.upsert({
          where: {
            key: permissionKey
          },
          create: {
            key: permissionKey,
            description: `Allows ${permissionKey}.`
          },
          update: {}
        });
      }

      const ownerRole = await transaction.role.create({
        data: {
          organizationId: organization.id,
          key: "owner",
          name: "Owner",
          description: "Initial owner role created by provisional onboarding.",
          isSystem: true
        }
      });

      const ownerPermissions = await transaction.permission.findMany({
        where: {
          key: {
            in: ownerPermissionKeys
          }
        },
        select: {
          id: true
        }
      });

      await transaction.rolePermission.createMany({
        data: ownerPermissions.map((permission) => ({
          roleId: ownerRole.id,
          permissionId: permission.id
        })),
        skipDuplicates: true
      });

      const membership = await transaction.membership.create({
        data: {
          organizationId: organization.id,
          userId: actor.id,
          status: "ACTIVE"
        }
      });

      await transaction.membershipRole.create({
        data: {
          organizationId: organization.id,
          membershipId: membership.id,
          roleId: ownerRole.id,
          unitId: null
        }
      });

      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          unitId: defaultUnit.id,
          actorUserId: actor.id,
          action: "organization.created",
          entity: "Organization",
          entityId: organization.id,
          correlationId,
          metadata: {
            type: organization.type
          }
        }
      });

      return {
        organization,
        defaultUnit: {
          id: defaultUnit.id,
          organizationId: defaultUnit.organizationId,
          name: defaultUnit.name,
          code: defaultUnit.code
        }
      };
    });
  }
}
