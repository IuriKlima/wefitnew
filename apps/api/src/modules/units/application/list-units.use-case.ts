import { Inject, Injectable } from "@nestjs/common";

import type { UnitSummary } from "@gym-platform/contracts";

import { UnitsRepository } from "./units.repository.js";

@Injectable()
export class ListUnitsUseCase {
  constructor(@Inject(UnitsRepository) private readonly unitsRepository: UnitsRepository) {}

  execute(organizationId: string, unitId?: string): Promise<UnitSummary[]> {
    return this.unitsRepository.listForOrganization(organizationId, unitId);
  }
}
