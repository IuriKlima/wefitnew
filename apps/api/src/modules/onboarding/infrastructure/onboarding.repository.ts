import { Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";
import {
  isOnboardingPlanCompatible,
  type OrganizationOnboardingView
} from "@gym-platform/contracts";
import { Prisma } from "@gym-platform/database";
import {
  completeOnboardingPayloadSchema,
  onboardingPayloadSchema,
  type CancelOnboardingInput,
  type CompleteOnboardingInput,
  type OnboardingBusinessTypeInput,
  type OnboardingCompanyInput,
  type OnboardingOperationInput,
  type OnboardingPayload,
  type OnboardingPlanInput,
  type OnboardingResponsibleInput,
  type OnboardingUnitInput
} from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { AuditService } from "../../audit/audit.service.js";

type OnboardingScopeRow = {
  onboardingId: string;
  organizationId: string;
  status: OnboardingStatusValue;
};

type OnboardingStatusValue = "IN_PROGRESS" | "COMPLETED" | "CANCELED";

type StepKey = "businessType" | "company" | "unit" | "responsible" | "operation" | "plan";

type StepInput =
  | OnboardingBusinessTypeInput
  | OnboardingCompanyInput
  | OnboardingUnitInput
  | OnboardingResponsibleInput
  | OnboardingOperationInput
  | OnboardingPlanInput;

type StepPayload = StepInput extends infer TInput
  ? TInput extends { version: number }
    ? Omit<TInput, "version">
    : never
  : never;

@Injectable()
export class OnboardingRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  async start(actor: AuthenticatedActor, correlationId: string): Promise<void> {
    try {
      await this.prisma.withActorContext(
        { actorUserId: actor.userId, ...(correlationId ? { correlationId } : {}) },
        async (tx) => {
          await tx.$queryRaw`
            SELECT *
            FROM public."start_actor_onboarding"(
              ${actor.email ?? null},
              ${actor.name ?? null},
              ${correlationId || null}
            )
          `;
        }
      );
    } catch (error) {
      throw mapBootstrapError(error);
    }
  }

  findCurrent(actorUserId: string, correlationId: string) {
    return this.withCurrentOnboarding(actorUserId, correlationId, async (tx, scope) =>
      this.readView(tx, scope)
    );
  }

  resume(actorUserId: string, correlationId: string) {
    return this.requireCurrentOnboarding(actorUserId, correlationId, async (tx, scope) => {
      const current = await this.readRecord(tx, scope);
      if (current.status !== "CANCELED") {
        return this.readView(tx, scope);
      }

      const result = await tx.organizationOnboarding.updateMany({
        where: {
          id: scope.onboardingId,
          organizationId: scope.organizationId,
          status: "CANCELED",
          deletedAt: null,
          version: current.version
        },
        data: {
          status: "IN_PROGRESS",
          version: { increment: 1 }
        }
      });

      if (result.count === 0) {
        const concurrent = await this.readRecord(tx, scope);
        if (concurrent.status === "IN_PROGRESS") {
          return this.readView(tx, scope);
        }
        assertOptimisticUpdate(result.count);
      }

      await this.auditService.record(tx, {
        organizationId: scope.organizationId,
        actorUserId,
        action: "onboarding.resumed",
        entity: "OrganizationOnboarding",
        entityId: scope.onboardingId,
        correlationId,
        metadata: {
          resumedFrom: "CANCELED",
          version: current.version + 1
        }
      });

      return this.readView(tx, scope);
    });
  }

  updateStep(
    actorUserId: string,
    correlationId: string,
    step: { key: StepKey; number: number },
    input: StepInput
  ) {
    return this.requireCurrentOnboarding(actorUserId, correlationId, async (tx, scope) => {
      const current = await this.readRecord(tx, scope);
      assertInProgress(current.status);
      if (step.number > current.currentStep) {
        throw new DomainError(
          "A etapa anterior precisa ser concluida primeiro.",
          "ONBOARDING_STEP_NOT_AVAILABLE",
          409
        );
      }

      const { version, ...stepPayload } = input;
      const validatedStepPayload = stepPayload as StepPayload;
      const currentPayload = onboardingPayloadSchema.parse(current.payload);
      await this.assertStepBusinessRules(
        tx,
        actorUserId,
        step.key,
        validatedStepPayload,
        currentPayload
      );
      const invalidatesPlan =
        step.key === "businessType" &&
        currentPayload.plan !== undefined &&
        "type" in validatedStepPayload &&
        !isOnboardingPlanCompatible(
          validatedStepPayload.type,
          currentPayload.plan.selectedPlanCode
        );
      const payloadBase = invalidatesPlan ? removePlanAndReview(currentPayload) : currentPayload;
      const payload = onboardingPayloadSchema.parse({
        ...payloadBase,
        [step.key]: validatedStepPayload
      });
      const nextStep = invalidatesPlan ? 6 : Math.max(current.currentStep, step.number + 1);

      const result = await tx.organizationOnboarding.updateMany({
        where: {
          id: scope.onboardingId,
          organizationId: scope.organizationId,
          status: "IN_PROGRESS",
          deletedAt: null,
          version
        },
        data: {
          currentStep: nextStep,
          payload: payload as Prisma.InputJsonValue,
          ...(step.key === "plan" && "selectedPlanCode" in validatedStepPayload
            ? { selectedPlanCode: validatedStepPayload.selectedPlanCode }
            : invalidatesPlan
              ? { selectedPlanCode: null }
              : {}),
          version: { increment: 1 }
        }
      });
      assertOptimisticUpdate(result.count);

      await this.auditService.record(tx, {
        organizationId: scope.organizationId,
        actorUserId,
        action: "onboarding.step_saved",
        entity: "OrganizationOnboarding",
        entityId: scope.onboardingId,
        correlationId,
        metadata: {
          step: step.key,
          stepNumber: step.number,
          version: version + 1
        }
      });

      return this.readView(tx, scope);
    });
  }

  complete(actorUserId: string, correlationId: string, input: CompleteOnboardingInput) {
    return this.requireCurrentOnboarding(actorUserId, correlationId, async (tx, scope) => {
      const current = await this.readRecord(tx, scope);
      if (current.status === "COMPLETED") {
        return this.readView(tx, scope);
      }
      assertInProgress(current.status);
      if (current.currentStep !== 7) {
        throw new DomainError(
          "Conclua todas as etapas antes de ativar a organizacao.",
          "ONBOARDING_INCOMPLETE",
          409
        );
      }

      const currentPayload = onboardingPayloadSchema.parse(current.payload);
      const payload = completeOnboardingPayloadSchema.parse({
        ...currentPayload,
        review: { confirmAccuracy: input.confirmAccuracy }
      });
      await this.assertResponsibleIdentity(tx, actorUserId, payload.responsible.email);
      const unit = await tx.unit.findFirst({
        where: { organizationId: scope.organizationId, deletedAt: null },
        orderBy: { createdAt: "asc" }
      });
      if (!unit) {
        throw new DomainError(
          "A unidade principal do onboarding nao foi encontrada.",
          "ONBOARDING_UNIT_NOT_FOUND",
          409
        );
      }

      try {
        await tx.organization.update({
          where: { id: scope.organizationId },
          data: {
            type: payload.businessType.type,
            lifecycle: "ACTIVE",
            legalName: payload.company.legalName,
            tradeName: payload.company.tradeName ?? null,
            cnpj: payload.company.cnpj ?? null,
            businessEmail: payload.company.businessEmail,
            businessPhone: payload.company.businessPhone,
            timezone: payload.company.timezone
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DomainError(
            "Nao foi possivel concluir a configuracao com os dados informados.",
            "ONBOARDING_BUSINESS_CONFLICT",
            409
          );
        }
        throw error;
      }

      await tx.unit.update({
        where: { id: unit.id },
        data: {
          name: payload.unit.name,
          code: payload.unit.code,
          phone: payload.unit.phone,
          postalCode: payload.unit.postalCode,
          street: payload.unit.street,
          streetNumber: payload.unit.streetNumber,
          addressExtra: payload.unit.addressExtra ?? null,
          neighborhood: payload.unit.neighborhood,
          city: payload.unit.city,
          state: payload.unit.state,
          country: payload.unit.country,
          timezone: payload.unit.timezone,
          openingHours: payload.operation.openingHours
        }
      });

      const result = await tx.organizationOnboarding.updateMany({
        where: {
          id: scope.onboardingId,
          organizationId: scope.organizationId,
          status: "IN_PROGRESS",
          deletedAt: null,
          version: input.version
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          selectedPlanCode: payload.plan.selectedPlanCode,
          payload: payload as Prisma.InputJsonValue,
          version: { increment: 1 }
        }
      });
      assertOptimisticUpdate(result.count);

      await this.auditService.record(tx, {
        organizationId: scope.organizationId,
        unitId: unit.id,
        actorUserId,
        action: "onboarding.completed",
        entity: "OrganizationOnboarding",
        entityId: scope.onboardingId,
        correlationId,
        metadata: {
          organizationType: payload.businessType.type,
          selectedPlanCode: payload.plan.selectedPlanCode,
          version: input.version + 1
        }
      });

      return this.readView(tx, scope);
    });
  }

  cancel(actorUserId: string, correlationId: string, input: CancelOnboardingInput) {
    return this.requireCurrentOnboarding(actorUserId, correlationId, async (tx, scope) => {
      const current = await this.readRecord(tx, scope);
      assertInProgress(current.status);

      const result = await tx.organizationOnboarding.updateMany({
        where: {
          id: scope.onboardingId,
          organizationId: scope.organizationId,
          status: "IN_PROGRESS",
          deletedAt: null,
          version: input.version
        },
        data: {
          status: "CANCELED",
          version: { increment: 1 }
        }
      });
      assertOptimisticUpdate(result.count);

      await this.auditService.record(tx, {
        organizationId: scope.organizationId,
        actorUserId,
        action: "onboarding.canceled",
        entity: "OrganizationOnboarding",
        entityId: scope.onboardingId,
        correlationId,
        metadata: {
          reasonProvided: Boolean(input.reason),
          version: input.version + 1
        }
      });

      return this.readView(tx, scope);
    });
  }

  private async requireCurrentOnboarding<T>(
    actorUserId: string,
    correlationId: string,
    fn: (tx: Prisma.TransactionClient, scope: OnboardingScopeRow) => Promise<T>
  ): Promise<T> {
    const result = await this.withCurrentOnboarding(actorUserId, correlationId, fn);
    if (!result) {
      throw new DomainError(
        "Nenhum onboarding foi encontrado para esta conta.",
        "ONBOARDING_NOT_FOUND",
        404
      );
    }
    return result;
  }

  private withCurrentOnboarding<T>(
    actorUserId: string,
    correlationId: string,
    fn: (tx: Prisma.TransactionClient, scope: OnboardingScopeRow) => Promise<T>
  ): Promise<T | null> {
    return this.prisma.withActorContext(
      { actorUserId, ...(correlationId ? { correlationId } : {}) },
      async (tx) => {
        const [scope] = await tx.$queryRaw<OnboardingScopeRow[]>`
          SELECT * FROM public."resolve_actor_onboarding"()
        `;
        if (!scope) {
          return null;
        }

        await tx.$executeRaw`
          SELECT set_config('app.organization_id', ${scope.organizationId}, true)
        `;
        return fn(tx, scope);
      }
    );
  }

  private async readRecord(tx: Prisma.TransactionClient, scope: OnboardingScopeRow) {
    const onboarding = await tx.organizationOnboarding.findFirst({
      where: {
        id: scope.onboardingId,
        organizationId: scope.organizationId,
        deletedAt: null
      }
    });
    if (!onboarding) {
      throw new DomainError(
        "Nenhum onboarding foi encontrado para esta conta.",
        "ONBOARDING_NOT_FOUND",
        404
      );
    }
    return onboarding;
  }

  private async assertStepBusinessRules(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    stepKey: StepKey,
    stepPayload: StepPayload,
    currentPayload: OnboardingPayload
  ): Promise<void> {
    if (stepKey === "plan" && "selectedPlanCode" in stepPayload) {
      const businessType = currentPayload.businessType?.type;
      if (
        !businessType ||
        !isOnboardingPlanCompatible(businessType, stepPayload.selectedPlanCode)
      ) {
        throw new DomainError(
          "O plano selecionado nao e compativel com o tipo de negocio.",
          "ONBOARDING_PLAN_INCOMPATIBLE",
          400
        );
      }
    }

    if (stepKey === "responsible" && "email" in stepPayload) {
      await this.assertResponsibleIdentity(tx, actorUserId, stepPayload.email);
    }
  }

  private async assertResponsibleIdentity(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    responsibleEmail: string
  ): Promise<void> {
    const authenticatedUser = await tx.user.findFirst({
      where: { id: actorUserId, deletedAt: null },
      select: { email: true }
    });
    if (
      !authenticatedUser ||
      authenticatedUser.email.trim().toLowerCase() !== responsibleEmail.trim().toLowerCase()
    ) {
      throw new DomainError(
        "O e-mail do responsavel deve ser o e-mail da identidade autenticada.",
        "ONBOARDING_RESPONSIBLE_IDENTITY_MISMATCH",
        400
      );
    }
  }

  private async readView(
    tx: Prisma.TransactionClient,
    scope: OnboardingScopeRow
  ): Promise<OrganizationOnboardingView> {
    const onboarding = await this.readRecord(tx, scope);
    const [organization, unit, authenticatedUser] = await Promise.all([
      tx.organization.findFirst({
        where: { id: scope.organizationId, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true, lifecycle: true }
      }),
      tx.unit.findFirst({
        where: { organizationId: scope.organizationId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true }
      }),
      tx.user.findFirst({
        where: { id: onboarding.createdByUserId, deletedAt: null },
        select: { name: true, email: true }
      })
    ]);
    if (!organization || !unit || !authenticatedUser) {
      throw new DomainError(
        "O tenant provisorio esta inconsistente.",
        "ONBOARDING_TENANT_INCONSISTENT",
        409
      );
    }

    const payload = onboardingPayloadSchema.parse(onboarding.payload);
    return {
      id: onboarding.id,
      organizationId: onboarding.organizationId,
      status: onboarding.status,
      currentStep: onboarding.currentStep,
      selectedPlanCode:
        onboarding.selectedPlanCode as OrganizationOnboardingView["selectedPlanCode"],
      payload: payload as OrganizationOnboardingView["payload"],
      payloadVersion: 1,
      version: onboarding.version,
      completedAt: onboarding.completedAt?.toISOString() ?? null,
      authenticatedUser,
      organization: {
        id: organization.id,
        name: organization.tradeName ?? organization.legalName,
        lifecycle: organization.lifecycle
      },
      unit
    };
  }
}

function removePlanAndReview(payload: OnboardingPayload): OnboardingPayload {
  const { plan: _plan, review: _review, ...remainingPayload } = payload;
  return remainingPayload;
}

function assertInProgress(status: OnboardingStatusValue): void {
  if (status !== "IN_PROGRESS") {
    throw new DomainError(
      "Este onboarding esta em um estado terminal.",
      "ONBOARDING_TERMINAL_STATE",
      409
    );
  }
}

function assertOptimisticUpdate(count: number): void {
  if (count !== 1) {
    throw new DomainError(
      "O onboarding foi alterado em outra sessao. Recarregue para continuar.",
      "ONBOARDING_VERSION_CONFLICT",
      409
    );
  }
}

function mapBootstrapError(error: unknown): DomainError {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("onboarding_actor_not_eligible")) {
    return new DomainError(
      "Esta conta ja possui acesso a uma organizacao.",
      "ONBOARDING_ACTOR_NOT_ELIGIBLE",
      409
    );
  }
  if (message.includes("onboarding_actor_inactive")) {
    return new DomainError("Esta conta esta inativa.", "ONBOARDING_ACTOR_INACTIVE", 403);
  }
  if (message.includes("onboarding_identity_incomplete")) {
    return new DomainError(
      "A identidade autenticada nao possui nome e e-mail validos.",
      "ONBOARDING_IDENTITY_INCOMPLETE",
      409
    );
  }
  if (message.includes("onboarding_identity_conflict")) {
    return new DomainError(
      "Nao foi possivel iniciar o onboarding para esta conta.",
      "ONBOARDING_IDENTITY_CONFLICT",
      409
    );
  }

  return new DomainError("Nao foi possivel iniciar o onboarding.", "ONBOARDING_START_FAILED", 500);
}
