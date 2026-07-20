import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { OnboardingOpeningHours, OrganizationOnboardingView } from "@gym-platform/contracts";

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
    const first = await startOnboarding(currentActorUserId);
    const second = await startOnboarding(currentActorUserId);

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

  it("cancels logically and rejects later state regression", async () => {
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

  it("rate-limits repeated completion attempts per authenticated credential", async () => {
    const rateLimitedUserId = "d9999999-9999-4999-8999-999999999902";
    await seedUser(rateLimitedUserId, "Rate Complete", "rate-complete@example.test");
    const completed = await completeFlow(rateLimitedUserId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await completeOnboarding(rateLimitedUserId, completed.version);
      expect(response.statusCode).toBe(201);
      expect(parseView(response.payload).id).toBe(completed.id);
    }
    expect((await completeOnboarding(rateLimitedUserId, completed.version)).statusCode).toBe(429);
  });

  async function completeFlow(userId: string): Promise<OrganizationOnboardingView> {
    let view = parseView((await startOnboarding(userId)).payload);
    view = parseView(
      (
        await patchStep(userId, "businessType", {
          version: view.version,
          type: "GYM"
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
    view = parseView(
      (
        await patchStep(userId, "responsible", {
          version: view.version,
          name: "Responsavel Operacional",
          email: "responsavel@wefit.test",
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
    view = parseView(
      (
        await patchStep(userId, "plan", {
          version: view.version,
          selectedPlanCode: "GYM"
        })
      ).payload
    );
    const response = await completeOnboarding(userId, view.version);
    expect(response.statusCode).toBe(201);
    return parseView(response.payload);
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
