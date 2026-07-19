import { Inject, Injectable } from "@nestjs/common";

import type { UnitSummary } from "@gym-platform/contracts";
import { Prisma } from "@gym-platform/database";
import type { CreateUnitInput } from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { AuditService } from "../../audit/audit.service.js";
import type { UnitSnapshot } from "../domain/unit.js";

@Injectable()
export class UnitsRepository {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  async create(
    transaction: Prisma.TransactionClient,
    input: CreateUnitInput,
    actorUserId: string,
    correlationId: string
  ): Promise<UnitSnapshot> {
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

    await this.auditService.record(transaction, {
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
    });

    return unit;
  }

  async findForOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    unitId: string
  ): Promise<UnitSnapshot> {
    const unit = await transaction.unit.findFirst({
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

  async listForOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    unitId?: string
  ): Promise<UnitSummary[]> {
    return transaction.unit.findMany({
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

  countActiveForOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string
  ): Promise<number> {
    return transaction.unit.count({
      where: {
        organizationId,
        deletedAt: null
      }
    });
  }
}
