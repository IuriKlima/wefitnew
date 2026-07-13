import { Inject, Injectable } from "@nestjs/common";

import type { UnitSnapshot } from "../domain/unit.js";
import { UnitsRepository } from "./units.repository.js";

@Injectable()
export class GetUnitUseCase {
  constructor(@Inject(UnitsRepository) private readonly unitsRepository: UnitsRepository) {}

  execute(organizationId: string, unitId: string): Promise<UnitSnapshot> {
    return this.unitsRepository.findForOrganization(organizationId, unitId);
  }
}
