import { Body, Controller, Get, Inject, Patch, Post, Req } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";
import {
  cancelOnboardingSchema,
  completeOnboardingSchema,
  onboardingBusinessTypeSchema,
  onboardingCompanySchema,
  onboardingOperationSchema,
  onboardingPlanSchema,
  onboardingResponsibleSchema,
  onboardingUnitSchema,
  type CancelOnboardingInput,
  type CompleteOnboardingInput,
  type OnboardingBusinessTypeInput,
  type OnboardingCompanyInput,
  type OnboardingOperationInput,
  type OnboardingPlanInput,
  type OnboardingResponsibleInput,
  type OnboardingUnitInput
} from "@gym-platform/validation";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { ZodValidationPipe } from "../../../common/zod/zod-validation.pipe.js";
import { OnboardingService } from "../application/onboarding.service.js";

@Controller("onboarding")
export class OnboardingController {
  constructor(
    @Inject(OnboardingService)
    private readonly onboardingService: OnboardingService
  ) {}

  @Get("current")
  getCurrent(@CurrentActor() actor: AuthenticatedActor, @Req() request: RequestWithContext) {
    return this.onboardingService.getCurrent(actor, request.correlationId ?? "");
  }

  @Post("start")
  start(@CurrentActor() actor: AuthenticatedActor, @Req() request: RequestWithContext) {
    return this.onboardingService.start(actor, request.correlationId ?? "");
  }

  @Patch("current/steps/business-type")
  saveBusinessType(
    @Body(new ZodValidationPipe(onboardingBusinessTypeSchema)) input: OnboardingBusinessTypeInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.saveBusinessType(actor, request.correlationId ?? "", input);
  }

  @Patch("current/steps/company")
  saveCompany(
    @Body(new ZodValidationPipe(onboardingCompanySchema)) input: OnboardingCompanyInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.saveCompany(actor, request.correlationId ?? "", input);
  }

  @Patch("current/steps/unit")
  saveUnit(
    @Body(new ZodValidationPipe(onboardingUnitSchema)) input: OnboardingUnitInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.saveUnit(actor, request.correlationId ?? "", input);
  }

  @Patch("current/steps/responsible")
  saveResponsible(
    @Body(new ZodValidationPipe(onboardingResponsibleSchema)) input: OnboardingResponsibleInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.saveResponsible(actor, request.correlationId ?? "", input);
  }

  @Patch("current/steps/operation")
  saveOperation(
    @Body(new ZodValidationPipe(onboardingOperationSchema)) input: OnboardingOperationInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.saveOperation(actor, request.correlationId ?? "", input);
  }

  @Patch("current/steps/plan")
  savePlan(
    @Body(new ZodValidationPipe(onboardingPlanSchema)) input: OnboardingPlanInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.savePlan(actor, request.correlationId ?? "", input);
  }

  @Post("current/complete")
  complete(
    @Body(new ZodValidationPipe(completeOnboardingSchema)) input: CompleteOnboardingInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.complete(actor, request.correlationId ?? "", input);
  }

  @Post("current/cancel")
  cancel(
    @Body(new ZodValidationPipe(cancelOnboardingSchema)) input: CancelOnboardingInput,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    return this.onboardingService.cancel(actor, request.correlationId ?? "", input);
  }
}
