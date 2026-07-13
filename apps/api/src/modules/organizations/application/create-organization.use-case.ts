import { Inject, Injectable } from "@nestjs/common";

import type { CreateOrganizationInput } from "@gym-platform/validation";

import type { CreatedOrganizationResult } from "../domain/organization.js";
import { OrganizationsRepository } from "../infrastructure/organizations.repository.js";

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @Inject(OrganizationsRepository)
    private readonly organizationsRepository: OrganizationsRepository
  ) {}

  execute(
    input: CreateOrganizationInput,
    actorUserId: string,
    correlationId: string
  ): Promise<CreatedOrganizationResult> {
    return this.organizationsRepository.createWithDefaultUnit(input, actorUserId, correlationId);
  }
}
