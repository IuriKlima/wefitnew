import { Inject, Injectable } from "@nestjs/common";

import type { UnitSummary } from "@gym-platform/contracts";
import type { CreateUnitInput } from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import type { UnitSnapshot } from "../domain/unit.js";

@Injectable()
export class UnitsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    input: CreateUnitInput,
    actorUserId: string,
    correlationId: string
  ): Promise<UnitSnapshot> {
    return this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.findFirst({
        where: {
          id: input.organizationId,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!organization) {
        throw new DomainError("Organization not found.", "ORGANIZATION_NOT_FOUND", 404);
      }

      const unit = await transaction.unit.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          code: input.code ?? null,
          timezone: input.timezone ?? "America/Sao_Paulo"
        }
      });

      await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          unitId: unit.id,
          actorUserId,
          action: "unit.created",
          entity: "Unit",
          entityId: unit.id,
          correlationId,
          metadata: {
            code: unit.code
          }
        }
      });

      return unit;
    });
  }

  async findForOrganization(organizationId: string, unitId: string): Promise<UnitSnapshot> {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        organizationId,
        deletedAt: null
      }
    });

    if (!unit) {
      throw new DomainError("Unit not found for organization.", "UNIT_NOT_FOUND", 404);
    }

    return unit;
  }

  async listForOrganization(organizationId: string, unitId?: string): Promise<UnitSummary[]> {
    return this.prisma.unit.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(unitId ? { id: unitId } : {})
      },
      select: {
        id: true,
        name: true,
        code: true
      },
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });
  }

  countActiveForOrganization(organizationId: string): Promise<number> {
    return this.prisma.unit.count({
      where: {
        organizationId,
        deletedAt: null
      }
    });
  }
}
