import { Inject, Injectable } from "@nestjs/common";

import type { UnitSnapshot } from "../domain/unit.js";
import { permissionKeys } from "@gym-platform/permissions";
import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { UnitsRepository } from "./units.repository.js";

@Injectable()
export class GetUnitUseCase {
  constructor(
    @Inject(UnitsRepository) private readonly unitsRepository: UnitsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    unitId: string,
    actorUserId: string,
    correlationId: string
  ): Promise<UnitSnapshot> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId,
        unitId,
        actorUserId,
        correlationId,
        permission: permissionKeys.unitRead,
        permissionScope: "contextual"
      },
      (transaction) => this.unitsRepository.findForOrganization(transaction, organizationId, unitId)
    );
  }
}
