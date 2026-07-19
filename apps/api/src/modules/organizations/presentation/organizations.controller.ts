import { Body, Controller, ForbiddenException, Inject, Post, Req } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";
import { loadApiEnv } from "@gym-platform/config";
import { createOrganizationSchema, type CreateOrganizationInput } from "@gym-platform/validation";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { ZodValidationPipe } from "../../../common/zod/zod-validation.pipe.js";
import { CreateOrganizationUseCase } from "../application/create-organization.use-case.js";

@Controller("organizations")
export class OrganizationsController {
  constructor(
    @Inject(CreateOrganizationUseCase)
    private readonly createOrganizationUseCase: CreateOrganizationUseCase
  ) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createOrganizationSchema)) input: CreateOrganizationInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    if (!loadApiEnv().ORGANIZATION_SELF_SERVICE_ENABLED) {
      throw new ForbiddenException("Organization self-service onboarding is disabled.");
    }

    return this.createOrganizationUseCase.execute(input, actor.userId, request.correlationId ?? "");
  }
}
