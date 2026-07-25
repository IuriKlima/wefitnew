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
import {
  RATE_LIMITER,
  type RateLimitDecision,
  type RateLimiter
} from "../../../common/rate-limit/rate-limiter.js";
import { OnboardingRepository } from "../infrastructure/onboarding.repository.js";

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(OnboardingRepository)
    private readonly repository: OnboardingRepository,
    @Inject(RATE_LIMITER)
    private readonly rateLimiter: RateLimiter
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
    correlationId: string,
    clientIp: string
  ): Promise<OrganizationOnboardingView> {
    await this.assertRateLimit(actor.userId, clientIp, "start", 5);
    const current = await this.repository.findCurrent(actor.userId, correlationId);
    if (current) {
      if (current.status === "CANCELED") {
        return this.repository.resume(actor.userId, correlationId);
      }
      return current;
    }

    this.assertSelfServiceEnabled();
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

  async complete(
    actor: AuthenticatedActor,
    correlationId: string,
    clientIp: string,
    input: CompleteOnboardingInput
  ) {
    const current = await this.repository.findCurrent(actor.userId, correlationId);
    if (current?.status === "COMPLETED") {
      return current;
    }

    this.assertSelfServiceEnabled();
    await this.assertRateLimit(actor.userId, clientIp, "complete", 3);
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

  private async assertRateLimit(
    actorUserId: string,
    clientIp: string,
    action: "start" | "complete",
    max: number
  ): Promise<void> {
    const normalizedIp = clientIp.trim().toLowerCase().slice(0, 128) || "unknown";
    const decisions = await Promise.all([
      this.rateLimiter.consume({
        key: `onboarding:${action}:actor:${actorUserId}`,
        limit: max,
        ttlMs: 60_000
      }),
      this.rateLimiter.consume({
        key: `onboarding:${action}:ip:${normalizedIp}`,
        limit: max * 100,
        ttlMs: 60_000
      })
    ]);

    if (decisions.some(isDenied)) {
      throw new DomainError(
        "Muitas tentativas. Aguarde um minuto antes de tentar novamente.",
        "ONBOARDING_RATE_LIMITED",
        429
      );
    }
  }
}

function isDenied(decision: RateLimitDecision): boolean {
  return !decision.allowed;
}
