import { Inject, Injectable } from "@nestjs/common";

import type { UnitSummary } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { UnitsRepository } from "./units.repository.js";

@Injectable()
export class ListUnitsUseCase {
  constructor(
    @Inject(UnitsRepository) private readonly unitsRepository: UnitsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    actorUserId: string,
    correlationId: string,
    unitId?: string
  ): Promise<UnitSummary[]> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId,
        actorUserId,
        correlationId,
        permission: permissionKeys.unitRead,
        permissionScope: "contextual",
        ...(unitId ? { unitId } : {})
      },
      (transaction) => this.unitsRepository.listForOrganization(transaction, organizationId, unitId)
    );
  }
}
