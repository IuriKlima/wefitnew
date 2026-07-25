import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "@gym-platform/database";

import { DomainError } from "../../../common/errors/domain-error.js";
import { SubscriptionsService } from "../../subscriptions/subscriptions.service.js";

const studentManagementFeature = "students.manage";

@Injectable()
export class StudentManagementPolicy {
  constructor(
    @Inject(SubscriptionsService)
    private readonly subscriptionsService: SubscriptionsService
  ) {}

  async assertEntitled(
    transaction: Prisma.TransactionClient,
    organizationId: string
  ): Promise<void> {
    const feature = await this.subscriptionsService.resolveOrganizationFeature(
      organizationId,
      studentManagementFeature,
      transaction
    );

    if (feature.hasEffectiveSubscription && !feature.entitlement.enabled) {
      throw new DomainError(
        "Student management is not enabled for the current plan.",
        "STUDENT_MANAGEMENT_NOT_ENTITLED",
        403
      );
    }
  }
}
