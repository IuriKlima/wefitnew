import { Inject, Injectable } from "@nestjs/common";

import type { CreateUnitInput } from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { SubscriptionsService } from "../../subscriptions/subscriptions.service.js";
import type { UnitSnapshot } from "../domain/unit.js";
import { UnitsRepository } from "./units.repository.js";

@Injectable()
export class CreateUnitUseCase {
  constructor(
    @Inject(UnitsRepository) private readonly unitsRepository: UnitsRepository,
    @Inject(SubscriptionsService) private readonly subscriptionsService: SubscriptionsService
  ) {}

  async execute(
    input: CreateUnitInput,
    actorUserId: string,
    correlationId: string
  ): Promise<UnitSnapshot> {
    const feature = await this.subscriptionsService.resolveOrganizationFeature(
      input.organizationId,
      "units.manage"
    );

    if (feature.hasEffectiveSubscription) {
      if (!feature.entitlement.enabled) {
        throw new DomainError(
          "Unit management feature is not enabled.",
          "FEATURE_NOT_ENABLED",
          403
        );
      }

      if (feature.entitlement.limitValue !== null) {
        const currentUnits = await this.unitsRepository.countActiveForOrganization(
          input.organizationId
        );

        if (currentUnits >= feature.entitlement.limitValue) {
          throw new DomainError("Unit limit reached.", "UNIT_LIMIT_REACHED", 403);
        }
      }
    }

    return this.unitsRepository.create(input, actorUserId, correlationId);
  }
}
