import { Module } from "@nestjs/common";

import { CreateOrganizationUseCase } from "./application/create-organization.use-case.js";
import { OrganizationsRepository } from "./infrastructure/organizations.repository.js";
import { OrganizationsController } from "./presentation/organizations.controller.js";

@Module({
  controllers: [OrganizationsController],
  providers: [CreateOrganizationUseCase, OrganizationsRepository],
  exports: [OrganizationsRepository]
})
export class OrganizationsModule {}
