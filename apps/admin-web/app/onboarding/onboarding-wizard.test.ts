import { describe, expect, it } from "vitest";

import type { OrganizationOnboardingPayload } from "@gym-platform/contracts";

import {
  buildOpeningHours,
  createDefaultOpeningHours,
  createOnboardingSummary,
  wizardSteps
} from "./onboarding-wizard";

describe("guided onboarding UI model", () => {
  it("keeps the seven requested steps in order", () => {
    expect(wizardSteps).toEqual([
      "Seu negocio",
      "Dados da empresa",
      "Unidade principal",
      "Responsavel",
      "Operacao",
      "Plano Wefit",
      "Revisao"
    ]);
  });

  it("aggregates persisted data for the review", () => {
    const summary = createOnboardingSummary({
      schemaVersion: 1,
      businessType: { type: "GYM" },
      company: {
        legalName: "Wefit Centro Ltda",
        tradeName: "Wefit Centro",
        businessEmail: "contato@example.test",
        businessPhone: "1133334444",
        timezone: "America/Sao_Paulo"
      },
      unit: {
        name: "Centro",
        code: "CENTRO",
        phone: "1133334444",
        postalCode: "01310100",
        street: "Avenida Paulista",
        streetNumber: "1000",
        neighborhood: "Bela Vista",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        timezone: "America/Sao_Paulo"
      },
      responsible: {
        name: "Responsavel",
        email: "owner@example.test",
        phone: "11999998888"
      },
      operation: {
        modalities: ["STRENGTH"],
        preference: "MIXED",
        openingHours: createDefaultOpeningHours()
      },
      plan: { selectedPlanCode: "GYM" }
    } satisfies OrganizationOnboardingPayload);

    expect(summary).toContainEqual({ label: "Empresa", value: "Wefit Centro" });
    expect(summary).toContainEqual({
      label: "Unidade",
      value: "Centro (CENTRO) - Sao Paulo/SP"
    });
  });

  it("serializes enabled and closed weekdays into the versioned schedule", () => {
    const form = new FormData();
    form.set("enabled-MONDAY", "on");
    form.set("opensAt-MONDAY", "06:00");
    form.set("closesAt-MONDAY", "22:00");

    const schedule = buildOpeningHours(form);

    expect(schedule.days[0]).toEqual({
      day: "MONDAY",
      enabled: true,
      periods: [{ opensAt: "06:00", closesAt: "22:00" }]
    });
    expect(schedule.days[6]).toEqual({ day: "SUNDAY", enabled: false, periods: [] });
  });
});
