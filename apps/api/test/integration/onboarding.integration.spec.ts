import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { OnboardingOpeningHours, OrganizationOnboardingView } from "@gym-platform/contracts";
import { Prisma } from "@gym-platform/database";

import { createTestApp } from "../test-app.js";
import {
  assertDatabaseAvailable,
  createTestPrismaClient,
  resetDatabase
} from "../test-database.js";
import { configureIntegrationTestEnv } from "../test-env.js";

configureIntegrationTestEnv();

describe("guided organization onboarding integration", () => {
  const prisma = createTestPrismaClient();
  let app: NestFastifyApplication;
  let currentActorUserId: string;

  beforeAll(async () => {
    await assertDatabaseAvailable(prisma);
    app = await createTestApp();
  });

  beforeEach(async () => {
    process.env.ORGANIZATION_SELF_SERVICE_ENABLED = "true";
    await resetDatabase(prisma);
    currentActorUserId = randomUUID();
    await seedUser(currentActorUserId, "Responsavel principal", "owner@example.test");
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it("keeps self-service disabled unless the environment explicitly enables it", async () => {
    process.env.ORGANIZATION_SELF_SERVICE_ENABLED = "false";

    const response = await startOnboarding(currentActorUserId);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: "ORGANIZATION_SELF_SERVICE_DISABLED"
    });
    expect(await prisma.organizationOnboarding.count()).toBe(0);
  });

  it("bootstraps one provisional tenant transactionally and idempotently", async () => {
    const [first, second] = await Promise.all([
      startOnboarding(currentActorUserId),
      startOnboarding(currentActorUserId)
    ]);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    const firstView = parseView(first.payload);
    const secondView = parseView(second.payload);
    expect(secondView.id).toBe(firstView.id);
    expect(firstView).toMatchObject({
      status: "IN_PROGRESS",
      currentStep: 1,
      version: 1,
      organization: { lifecycle: "ONBOARDING" }
    });

    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.unit.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
    expect(await prisma.membershipRole.count()).toBe(1);
    expect(await prisma.role.count({ where: { key: "owner" } })).toBe(1);
    expect(await prisma.organizationOnboarding.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "onboarding.started" } })).toBe(1);
  });

  it("persists a saved step across exit, refresh and idempotent return", async () => {
    const started = parseView((await startOnboarding(currentActorUserId)).payload);
    const saved = parseView(
      (
        await patchStep(currentActorUserId, "businessType", {
          version: started.version,
          type: "GYM"
        })
      ).payload
    );

    const refreshed = await app.inject({
      method: "GET",
      url: "/onboarding/current",
      headers: authHeaders(currentActorUserId)
    });
    const returned = await startOnboarding(currentActorUserId);

    expect(JSON.parse(refreshed.payload)).toMatchObject({
      onboarding: {
        id: saved.id,
        currentStep: 2,
        version: 2,
        payload: { businessType: { type: "GYM" } }
      }
    });
    expect(parseView(returned.payload)).toMatchObject({
      id: saved.id,
      organizationId: saved.organizationId,
      currentStep: 2,
      version: 2
    });
    expect(await prisma.organization.count()).toBe(1);
  });

  it("rolls back bootstrap when the authenticated identity is incomplete", async () => {
    const missingDomainUserId = "d1111111-1111-4111-8111-111111111111";

    const response = await startOnboarding(missingDomainUserId);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: "ONBOARDING_IDENTITY_INCOMPLETE"
    });
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.unit.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
    expect(await prisma.organizationOnboarding.count()).toBe(0);
  });

  it("rejects an archived domain user", async () => {
    await prisma.user.update({
      where: { id: currentActorUserId },
      data: { deletedAt: new Date() }
    });

    const response = await startOnboarding(currentActorUserId);

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toMatchObject({ code: "ONBOARDING_ACTOR_INACTIVE" });
    expect(await prisma.organization.count()).toBe(0);
  });

  it("does not allow a step jump or a stale concurrent write", async () => {
    const started = parseView((await startOnboarding(currentActorUserId)).payload);
    expect((await completeOnboarding(currentActorUserId, started.version)).statusCode).toBe(409);
    const jumpResponse = await patchStep(currentActorUserId, "operation", {
      version: started.version,
      modalities: ["STRENGTH"],
      preference: "MIXED",
      openingHours: openingHours()
    });
    expect(jumpResponse.statusCode).toBe(409);

    const payload = { version: started.version, type: "GYM" };
    const firstSave = await patchStep(currentActorUserId, "businessType", payload);
    const staleSave = await patchStep(currentActorUserId, "businessType", payload);

    expect(firstSave.statusCode).toBe(200);
    expect(parseView(firstSave.payload)).toMatchObject({ currentStep: 2, version: 2 });
    expect(staleSave.statusCode).toBe(409);
    expect(JSON.parse(staleSave.payload)).toMatchObject({ code: "ONBOARDING_VERSION_CONFLICT" });
  });

  it("validates CNPJ conditionally and never accepts a client tenant as authority", async () => {
    let view = parseView((await startOnboarding(currentActorUserId)).payload);
    view = parseView(
      (await patchStep(currentActorUserId, "businessType", { version: view.version, type: "GYM" }))
        .payload
    );
    const invalid = await patchStep(currentActorUserId, "company", {
      ...companyPayload(view.version),
      organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cnpj: "123"
    });
    expect(invalid.statusCode).toBe(400);

    view = parseView(
      (
        await patchStep(currentActorUserId, "businessType", {
          version: view.version,
          type: "PERSONAL"
        })
      ).payload
    );
    const personal = await patchStep(currentActorUserId, "company", {
      ...companyPayload(view.version),
      cnpj: ""
    });
    expect(personal.statusCode).toBe(200);
    expect(parseView(personal.payload).organizationId).toBe(view.organizationId);
  });

  it("denies business modules while the organization is onboarding", async () => {
    const started = parseView((await startOnboarding(currentActorUserId)).payload);

    const response = await app.inject({
      method: "GET",
      url: `/organizations/${started.organizationId}/units`,
      headers: authHeaders(currentActorUserId)
    });

    expect(response.statusCode).toBe(403);
  });

  it("isolates onboarding discovery by authenticated actor", async () => {
    await startOnboarding(currentActorUserId);
    const otherUserId = "d2222222-2222-4222-8222-222222222222";
    await seedUser(otherUserId, "Outra pessoa", "other@example.test");

    const current = await app.inject({
      method: "GET",
      url: "/onboarding/current",
      headers: authHeaders(otherUserId)
    });
    const update = await patchStep(otherUserId, "businessType", { version: 1, type: "GYM" });

    expect(current.statusCode).toBe(200);
    expect(JSON.parse(current.payload)).toMatchObject({ onboarding: null });
    expect(update.statusCode).toBe(404);
  });

  it("recovers a legacy canceled onboarding without creating a duplicate tenant", async () => {
    const started = parseView((await startOnboarding(currentActorUserId)).payload);
    const cancel = await app.inject({
      method: "POST",
      url: "/onboarding/current/cancel",
      headers: authHeaders(currentActorUserId),
      payload: { version: started.version, reason: "Decidi configurar depois" }
    });
    expect(cancel.statusCode).toBe(201);
    expect(parseView(cancel.payload)).toMatchObject({ status: "CANCELED", version: 2 });

    const regression = await patchStep(currentActorUserId, "businessType", {
      version: 2,
      type: "GYM"
    });
    expect(regression.statusCode).toBe(409);
    expect(JSON.parse(regression.payload)).toMatchObject({ code: "ONBOARDING_TERMINAL_STATE" });

    const resumed = parseView((await startOnboarding(currentActorUserId)).payload);
    expect(resumed).toMatchObject({
      id: started.id,
      organizationId: started.organizationId,
      status: "IN_PROGRESS",
      version: 3
    });
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.organizationOnboarding.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "onboarding.resumed" } })).toBe(1);

    const continued = await patchStep(currentActorUserId, "businessType", {
      version: resumed.version,
      type: "GYM"
    });
    expect(continued.statusCode).toBe(200);
  });

  it.each([
    ["PERSONAL", "PERSONAL"],
    ["GYM", "GYM"],
    ["NETWORK", "NETWORK"]
  ] as const)("accepts the compatible %s and %s combination", async (businessType, planCode) => {
    const view = await preparePlanStep(currentActorUserId, "owner@example.test", businessType);
    const response = await patchStep(currentActorUserId, "plan", {
      version: view.version,
      selectedPlanCode: planCode
    });

    expect(response.statusCode).toBe(200);
    expect(parseView(response.payload).selectedPlanCode).toBe(planCode);
  });

  it.each([
    ["PERSONAL", "GYM"],
    ["GYM", "NETWORK"],
    ["NETWORK", "PERSONAL"]
  ] as const)("rejects the incompatible %s and %s combination", async (businessType, planCode) => {
    const view = await preparePlanStep(currentActorUserId, "owner@example.test", businessType);
    const response = await patchStep(currentActorUserId, "plan", {
      version: view.version,
      selectedPlanCode: planCode
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toMatchObject({ code: "ONBOARDING_PLAN_INCOMPATIBLE" });
  });

  it("keeps the authenticated identity authoritative and the business contact separate", async () => {
    const view = await prepareResponsibleStep(currentActorUserId, "GYM");
    const spoofed = await patchStep(currentActorUserId, "responsible", {
      version: view.version,
      name: "Terceiro",
      email: "third-party@example.test",
      phone: "11999998888"
    });

    expect(spoofed.statusCode).toBe(400);
    expect(JSON.parse(spoofed.payload)).toMatchObject({
      code: "ONBOARDING_RESPONSIBLE_IDENTITY_MISMATCH"
    });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: currentActorUserId } })
    ).toMatchObject({
      email: "owner@example.test"
    });

    const accepted = await patchStep(currentActorUserId, "responsible", {
      version: view.version,
      name: "Responsavel principal",
      email: "owner@example.test",
      phone: "11999998888",
      title: "Proprietario"
    });
    expect(accepted.statusCode).toBe(200);
    expect(parseView(accepted.payload).payload).toMatchObject({
      company: { businessEmail: "contato@wefit.test" },
      responsible: { email: "owner@example.test" }
    });
  });

  it("rejects a legacy responsible spoof during completion and rolls back the transaction", async () => {
    let view = await preparePlanStep(currentActorUserId, "owner@example.test", "GYM");
    view = parseView(
      (
        await patchStep(currentActorUserId, "plan", {
          version: view.version,
          selectedPlanCode: "GYM"
        })
      ).payload
    );
    const persisted = await prisma.organizationOnboarding.findUniqueOrThrow({
      where: { id: view.id }
    });
    const persistedPayload = persisted.payload as Prisma.JsonObject;
    await prisma.organizationOnboarding.update({
      where: { id: view.id },
      data: {
        payload: {
          ...persistedPayload,
          responsible: {
            name: "Terceiro legado",
            email: "third-party@example.test",
            phone: "11999998888"
          }
        }
      }
    });

    const beforeOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: view.organizationId }
    });
    const beforeUnit = await prisma.unit.findFirstOrThrow({
      where: { organizationId: view.organizationId }
    });
    const beforeOnboarding = await prisma.organizationOnboarding.findUniqueOrThrow({
      where: { id: view.id }
    });
    const beforeAuditCount = await prisma.auditLog.count({
      where: { organizationId: view.organizationId }
    });

    const response = await completeOnboarding(currentActorUserId, view.version);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: "ONBOARDING_RESPONSIBLE_IDENTITY_MISMATCH"
    });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: currentActorUserId } })
    ).toMatchObject({
      email: "owner@example.test",
      deletedAt: null
    });
    expect(
      await prisma.organization.findUniqueOrThrow({ where: { id: view.organizationId } })
    ).toEqual(beforeOrganization);
    expect(
      await prisma.unit.findFirstOrThrow({ where: { organizationId: view.organizationId } })
    ).toEqual(beforeUnit);
    expect(
      await prisma.organizationOnboarding.findUniqueOrThrow({ where: { id: view.id } })
    ).toEqual(beforeOnboarding);
    expect(await prisma.auditLog.count({ where: { organizationId: view.organizationId } })).toBe(
      beforeAuditCount
    );
    expect(beforeOrganization.lifecycle).toBe("ONBOARDING");
    expect(beforeOnboarding.status).toBe("IN_PROGRESS");
  });

  it("persists all seven steps and activates the tenant in one completion transaction", async () => {
    const completed = await completeFlow(currentActorUserId);

    expect(completed).toMatchObject({
      status: "COMPLETED",
      currentStep: 7,
      version: 8,
      selectedPlanCode: "GYM",
      organization: { lifecycle: "ACTIVE", name: "Wefit Centro" }
    });

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: completed.organizationId }
    });
    expect(organization).toMatchObject({
      type: "GYM",
      lifecycle: "ACTIVE",
      legalName: "Wefit Centro Ltda",
      tradeName: "Wefit Centro",
      cnpj: "11222333000181",
      businessEmail: "contato@wefit.test",
      businessPhone: "1133334444"
    });

    const unit = await prisma.unit.findFirstOrThrow({
      where: { organizationId: completed.organizationId }
    });
    expect(unit).toMatchObject({
      name: "Unidade Centro",
      code: "CENTRO",
      postalCode: "01310100",
      city: "Sao Paulo",
      state: "SP",
      country: "BR"
    });
    expect(unit.openingHours).toMatchObject({ version: 1 });
    expect(
      await prisma.auditLog.count({ where: { organizationId: completed.organizationId } })
    ).toBe(8);
  });

  it("rate-limits repeated bootstrap attempts per authenticated credential", async () => {
    const rateLimitedUserId = "d9999999-9999-4999-8999-999999999901";
    await seedUser(rateLimitedUserId, "Rate Start", "rate-start@example.test");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await startOnboarding(rateLimitedUserId)).statusCode).toBe(201);
    }
    expect((await startOnboarding(rateLimitedUserId)).statusCode).toBe(429);
  });

  it("rate-limits repeated non-idempotent completion attempts per authenticated credential", async () => {
    const rateLimitedUserId = "d9999999-9999-4999-8999-999999999902";
    await seedUser(rateLimitedUserId, "Rate Complete", "rate-complete@example.test");
    const started = parseView((await startOnboarding(rateLimitedUserId)).payload);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await completeOnboarding(rateLimitedUserId, started.version);
      expect(response.statusCode).toBe(409);
    }
    expect((await completeOnboarding(rateLimitedUserId, started.version)).statusCode).toBe(429);
  });

  it("returns the same completed result when completion is repeated", async () => {
    const completed = await completeFlow(currentActorUserId, "owner@example.test");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await completeOnboarding(currentActorUserId, completed.version);
      expect(response.statusCode).toBe(201);
      expect(parseView(response.payload)).toMatchObject({
        id: completed.id,
        organizationId: completed.organizationId,
        status: "COMPLETED"
      });
    }
  });

  async function completeFlow(
    userId: string,
    responsibleEmail = "owner@example.test",
    businessType: "PERSONAL" | "GYM" | "NETWORK" = "GYM"
  ): Promise<OrganizationOnboardingView> {
    let view = await preparePlanStep(userId, responsibleEmail, businessType);
    view = parseView(
      (
        await patchStep(userId, "plan", {
          version: view.version,
          selectedPlanCode: businessType
        })
      ).payload
    );
    const response = await completeOnboarding(userId, view.version);
    expect(response.statusCode).toBe(201);
    return parseView(response.payload);
  }

  async function prepareResponsibleStep(
    userId: string,
    businessType: "PERSONAL" | "GYM" | "NETWORK"
  ): Promise<OrganizationOnboardingView> {
    let view = parseView((await startOnboarding(userId)).payload);
    view = parseView(
      (
        await patchStep(userId, "businessType", {
          version: view.version,
          type: businessType
        })
      ).payload
    );
    view = parseView((await patchStep(userId, "company", companyPayload(view.version))).payload);
    view = parseView(
      (
        await patchStep(userId, "unit", {
          version: view.version,
          name: "Unidade Centro",
          code: "CENTRO",
          phone: "(11) 3333-4444",
          postalCode: "01310-100",
          street: "Avenida Paulista",
          streetNumber: "1000",
          addressExtra: "Conjunto 10",
          neighborhood: "Bela Vista",
          city: "Sao Paulo",
          state: "SP",
          country: "BR",
          timezone: "America/Sao_Paulo"
        })
      ).payload
    );
    return view;
  }

  async function preparePlanStep(
    userId: string,
    responsibleEmail: string,
    businessType: "PERSONAL" | "GYM" | "NETWORK"
  ): Promise<OrganizationOnboardingView> {
    let view = await prepareResponsibleStep(userId, businessType);
    view = parseView(
      (
        await patchStep(userId, "responsible", {
          version: view.version,
          name: "Responsavel Operacional",
          email: responsibleEmail,
          phone: "11999998888",
          title: "Gestao"
        })
      ).payload
    );
    view = parseView(
      (
        await patchStep(userId, "operation", {
          version: view.version,
          modalities: ["STRENGTH", "FUNCTIONAL"],
          preference: "MIXED",
          openingHours: openingHours()
        })
      ).payload
    );
    return view;
  }

  function startOnboarding(userId: string) {
    return app.inject({
      method: "POST",
      url: "/onboarding/start",
      headers: authHeaders(userId)
    });
  }

  function patchStep(userId: string, step: string, payload: Record<string, unknown>) {
    const path = step === "businessType" ? "business-type" : step;
    return app.inject({
      method: "PATCH",
      url: `/onboarding/current/steps/${path}`,
      headers: authHeaders(userId),
      payload
    });
  }

  function completeOnboarding(userId: string, version: number) {
    return app.inject({
      method: "POST",
      url: "/onboarding/current/complete",
      headers: authHeaders(userId),
      payload: { version, confirmAccuracy: true }
    });
  }

  async function seedUser(id: string, name: string, email: string) {
    await prisma.user.create({ data: { id, name, email } });
  }
});

function parseView(payload: string): OrganizationOnboardingView {
  return JSON.parse(payload) as OrganizationOnboardingView;
}

function companyPayload(version: number) {
  return {
    version,
    legalName: "Wefit Centro Ltda",
    tradeName: "Wefit Centro",
    cnpj: "11.222.333/0001-81",
    businessEmail: "contato@wefit.test",
    businessPhone: "(11) 3333-4444",
    timezone: "America/Sao_Paulo"
  };
}

function openingHours(): OnboardingOpeningHours {
  const weekdays: OnboardingOpeningHours["days"][number]["day"][] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
  ];
  return {
    version: 1,
    days: weekdays.map((day, index) => ({
      day,
      enabled: index < 6,
      periods: index < 6 ? [{ opensAt: "06:00", closesAt: index === 5 ? "14:00" : "22:00" }] : []
    }))
  };
}

function authHeaders(userId: string) {
  return { "x-dev-user-id": userId };
}
