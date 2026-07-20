import { describe, expect, it } from "vitest";

import {
  completeOnboardingPayloadSchema,
  onboardingBusinessTypeSchema,
  onboardingCompanySchema,
  onboardingOperationSchema,
  onboardingPlanSchema,
  onboardingResponsibleSchema,
  onboardingUnitSchema,
  type OnboardingOperationInput
} from "./onboarding.js";

describe("onboarding validation", () => {
  it("validates every persisted step with a version", () => {
    expect(onboardingBusinessTypeSchema.parse({ version: 1, type: "GYM" })).toMatchObject({
      version: 1,
      type: "GYM"
    });
    expect(onboardingUnitSchema.parse(validUnit())).toMatchObject({
      code: "CENTRO",
      postalCode: "01310100",
      country: "BR"
    });
    expect(
      onboardingResponsibleSchema.parse({
        version: 4,
        name: "Responsavel",
        email: "OWNER@EXAMPLE.TEST",
        phone: "(11) 99999-8888"
      })
    ).toMatchObject({ email: "owner@example.test", phone: "11999998888" });
    expect(onboardingPlanSchema.parse({ version: 6, selectedPlanCode: "GYM" })).toMatchObject({
      selectedPlanCode: "GYM"
    });
  });

  it("normalizes a valid CNPJ, e-mail and phone", () => {
    const result = onboardingCompanySchema.parse({
      ...validCompany(),
      cnpj: "11.222.333/0001-81",
      businessEmail: "CONTATO@EXAMPLE.TEST",
      businessPhone: "(11) 3333-4444"
    });

    expect(result.cnpj).toBe("11222333000181");
    expect(result.businessEmail).toBe("contato@example.test");
    expect(result.businessPhone).toBe("1133334444");
  });

  it("allows Personal without CNPJ and requires it for Academia or Rede at completion", () => {
    const personal = completePayload("PERSONAL", "PERSONAL", false);
    expect(completeOnboardingPayloadSchema.parse(personal).company.cnpj).toBeUndefined();

    for (const type of ["GYM", "NETWORK"] as const) {
      const payload = completePayload(type, type, false);
      expect(() => completeOnboardingPayloadSchema.parse(payload)).toThrow();
    }
  });

  it("rejects repeated or malformed CNPJ values", () => {
    for (const cnpj of ["11.111.111/1111-11", "12.345.678/0001-00"]) {
      expect(() => onboardingCompanySchema.parse({ ...validCompany(), cnpj })).toThrow();
    }
  });

  it("accepts a complete versioned weekly schedule and operation preferences", () => {
    expect(onboardingOperationSchema.parse(validOperation())).toEqual(validOperation());
  });

  it("rejects overlapping periods and duplicate weekdays", () => {
    const operation = validOperation();
    operation.openingHours.days[0]!.periods = [
      { opensAt: "06:00", closesAt: "12:00" },
      { opensAt: "11:00", closesAt: "18:00" }
    ];
    operation.openingHours.days[1]!.day = "MONDAY";

    expect(() => onboardingOperationSchema.parse(operation)).toThrow();
  });
});

function validCompany() {
  return {
    version: 2,
    legalName: "Academia Teste Ltda",
    tradeName: "Academia Teste",
    cnpj: "11222333000181",
    businessEmail: "contato@example.test",
    businessPhone: "1133334444",
    timezone: "America/Sao_Paulo"
  };
}

function validUnit() {
  return {
    version: 3,
    name: "Unidade Centro",
    code: "centro",
    phone: "1133334444",
    postalCode: "01310-100",
    street: "Avenida Paulista",
    streetNumber: "1000",
    neighborhood: "Bela Vista",
    city: "Sao Paulo",
    state: "sp",
    country: "br",
    timezone: "America/Sao_Paulo"
  };
}

function validOperation(): OnboardingOperationInput {
  const days: OnboardingOperationInput["openingHours"]["days"] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY"
  ].map((day, index) => ({
    day: day as OnboardingOperationInput["openingHours"]["days"][number]["day"],
    enabled: index < 6,
    periods: index < 6 ? [{ opensAt: "06:00", closesAt: "22:00" }] : []
  }));

  return {
    version: 5,
    modalities: ["STRENGTH", "FUNCTIONAL"],
    preference: "MIXED",
    openingHours: { version: 1, days }
  };
}

function completePayload(
  type: "PERSONAL" | "GYM" | "NETWORK",
  selectedPlanCode: "PERSONAL" | "GYM" | "NETWORK",
  includeCnpj = true
) {
  const { version: _companyVersion, ...company } = validCompany();
  const { cnpj: _cnpj, ...companyWithoutCnpj } = company;
  const { version: _unitVersion, ...unit } = validUnit();
  const { version: _operationVersion, ...operation } = validOperation();
  return {
    schemaVersion: 1 as const,
    businessType: { type },
    company: includeCnpj ? company : companyWithoutCnpj,
    unit,
    responsible: {
      name: "Responsavel",
      email: "owner@example.test",
      phone: "11999998888"
    },
    operation,
    plan: { selectedPlanCode },
    review: { confirmAccuracy: true as const }
  };
}
