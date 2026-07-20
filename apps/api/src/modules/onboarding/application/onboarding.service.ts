import { Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";
import { loadApiEnv } from "@gym-platform/config";
import type { OnboardingAvailability, OrganizationOnboardingView } from "@gym-platform/contracts";
import type {
  CancelOnboardingInput,
  CompleteOnboardingInput,
  OnboardingBusinessTypeInput,
  OnboardingCompanyInput,
  OnboardingOperationInput,
  OnboardingPlanInput,
  OnboardingResponsibleInput,
  OnboardingUnitInput
} from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { OnboardingRepository } from "../infrastructure/onboarding.repository.js";

@Injectable()
export class OnboardingService {
  private readonly rateLimits = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    @Inject(OnboardingRepository)
    private readonly repository: OnboardingRepository
  ) {}

  async getCurrent(
    actor: AuthenticatedActor,
    correlationId: string
  ): Promise<OnboardingAvailability> {
    return {
      selfServiceEnabled: loadApiEnv().ORGANIZATION_SELF_SERVICE_ENABLED,
      onboarding: await this.repository.findCurrent(actor.userId, correlationId)
    };
  }

  async start(
    actor: AuthenticatedActor,
    correlationId: string
  ): Promise<OrganizationOnboardingView> {
    this.assertSelfServiceEnabled();
    this.assertActorRateLimit(actor.userId, "start", 5);
    await this.repository.start(actor, correlationId);
    const onboarding = await this.repository.findCurrent(actor.userId, correlationId);
    if (!onboarding) {
      throw new DomainError(
        "O onboarding iniciado nao pode ser recuperado.",
        "ONBOARDING_START_INCONSISTENT",
        500
      );
    }
    return onboarding;
  }

  saveBusinessType(
    actor: AuthenticatedActor,
    correlationId: string,
    input: OnboardingBusinessTypeInput
  ) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "businessType", number: 1 },
      input
    );
  }

  saveCompany(actor: AuthenticatedActor, correlationId: string, input: OnboardingCompanyInput) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "company", number: 2 },
      input
    );
  }

  saveUnit(actor: AuthenticatedActor, correlationId: string, input: OnboardingUnitInput) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "unit", number: 3 },
      input
    );
  }

  saveResponsible(
    actor: AuthenticatedActor,
    correlationId: string,
    input: OnboardingResponsibleInput
  ) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "responsible", number: 4 },
      input
    );
  }

  saveOperation(actor: AuthenticatedActor, correlationId: string, input: OnboardingOperationInput) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "operation", number: 5 },
      input
    );
  }

  savePlan(actor: AuthenticatedActor, correlationId: string, input: OnboardingPlanInput) {
    return this.repository.updateStep(
      actor.userId,
      correlationId,
      { key: "plan", number: 6 },
      input
    );
  }

  complete(actor: AuthenticatedActor, correlationId: string, input: CompleteOnboardingInput) {
    this.assertSelfServiceEnabled();
    this.assertActorRateLimit(actor.userId, "complete", 3);
    return this.repository.complete(actor.userId, correlationId, input);
  }

  cancel(actor: AuthenticatedActor, correlationId: string, input: CancelOnboardingInput) {
    return this.repository.cancel(actor.userId, correlationId, input);
  }

  private assertSelfServiceEnabled(): void {
    if (!loadApiEnv().ORGANIZATION_SELF_SERVICE_ENABLED) {
      throw new DomainError(
        "O onboarding self-service esta desabilitado.",
        "ORGANIZATION_SELF_SERVICE_DISABLED",
        403
      );
    }
  }

  private assertActorRateLimit(
    actorUserId: string,
    action: "start" | "complete",
    max: number
  ): void {
    const key = `${action}:${actorUserId}`;
    const now = Date.now();
    const current = this.rateLimits.get(key);
    if (!current || current.expiresAt <= now) {
      this.rateLimits.set(key, { count: 1, expiresAt: now + 60_000 });
      return;
    }

    if (current.count >= max) {
      throw new DomainError(
        "Muitas tentativas. Aguarde um minuto antes de tentar novamente.",
        "ONBOARDING_RATE_LIMITED",
        429
      );
    }

    current.count += 1;
  }
}
