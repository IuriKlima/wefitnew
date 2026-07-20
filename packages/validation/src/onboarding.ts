import { z } from "zod";

import { nonEmptyTrimmedString } from "./common.js";
import { organizationTypeSchema } from "./organization.js";

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const normalizedPhoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length >= 10 && value.length <= 13, "Telefone invalido.");

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/, "Fuso horario invalido.");

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (length: number): number => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(digits[index]) * factor;
      factor -= 1;
      if (factor === 1) {
        factor = 9;
      }
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
}

export const cnpjSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine(isValidCnpj, "CNPJ invalido.");

const optionalCnpjSchema = z.preprocess(
  (value) => (typeof value === "string" && value.replace(/\D/g, "") === "" ? undefined : value),
  cnpjSchema.optional()
);

export const onboardingVersionSchema = z.object({
  version: z.number().int().positive()
});

const onboardingBusinessTypeDataSchema = z.object({
  type: organizationTypeSchema
});

const onboardingCompanyDataSchema = z.object({
  legalName: nonEmptyTrimmedString.max(160),
  tradeName: optionalTrimmedString(120),
  cnpj: optionalCnpjSchema,
  businessEmail: z.string().trim().toLowerCase().email().max(160),
  businessPhone: normalizedPhoneSchema,
  timezone: timezoneSchema
});

export const onboardingBusinessTypeSchema = onboardingVersionSchema.extend({
  type: organizationTypeSchema
});

export const onboardingCompanySchema = z.intersection(
  onboardingVersionSchema,
  onboardingCompanyDataSchema
);

export const onboardingUnitSchema = onboardingVersionSchema.extend({
  name: nonEmptyTrimmedString.max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/),
  phone: normalizedPhoneSchema,
  postalCode: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 8, "CEP invalido."),
  street: nonEmptyTrimmedString.max(160),
  streetNumber: nonEmptyTrimmedString.max(20),
  addressExtra: optionalTrimmedString(80),
  neighborhood: nonEmptyTrimmedString.max(100),
  city: nonEmptyTrimmedString.max(100),
  state: z.string().trim().toUpperCase().length(2),
  country: z.string().trim().toUpperCase().length(2).default("BR"),
  timezone: timezoneSchema
});

export const onboardingResponsibleSchema = onboardingVersionSchema.extend({
  name: nonEmptyTrimmedString.max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: normalizedPhoneSchema,
  title: optionalTrimmedString(80)
});

export const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
]);

const hourMinuteSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const openingPeriodSchema = z
  .object({
    opensAt: hourMinuteSchema,
    closesAt: hourMinuteSchema
  })
  .refine((period) => period.opensAt < period.closesAt, {
    message: "O horario de abertura deve ser anterior ao fechamento."
  });

const openingDaySchema = z
  .object({
    day: weekdaySchema,
    enabled: z.boolean(),
    periods: z.array(openingPeriodSchema).max(3)
  })
  .superRefine((value, context) => {
    if (value.enabled && value.periods.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periods"],
        message: "Informe um horario."
      });
    }
    if (!value.enabled && value.periods.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periods"],
        message: "Um dia fechado nao pode ter horarios."
      });
    }

    const periods = [...value.periods].sort((left, right) =>
      left.opensAt.localeCompare(right.opensAt)
    );
    for (let index = 1; index < periods.length; index += 1) {
      if (periods[index - 1]!.closesAt > periods[index]!.opensAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["periods"],
          message: "Os periodos de funcionamento nao podem se sobrepor."
        });
        break;
      }
    }
  });

export const openingHoursSchema = z
  .object({
    version: z.literal(1),
    days: z.array(openingDaySchema).length(7)
  })
  .superRefine((value, context) => {
    if (new Set(value.days.map(({ day }) => day)).size !== 7) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days"],
        message: "Cada dia da semana deve aparecer uma unica vez."
      });
    }
  });

export const onboardingOperationSchema = onboardingVersionSchema.extend({
  modalities: z
    .array(
      z.enum(["STRENGTH", "FUNCTIONAL", "CROSS_TRAINING", "PILATES", "DANCE", "SWIMMING", "OTHER"])
    )
    .min(1)
    .max(7),
  openingHours: openingHoursSchema,
  preference: z.enum(["OPEN_GYM", "CLASSES", "MIXED"])
});

export const onboardingPlanCodeSchema = z.enum(["PERSONAL", "GYM", "NETWORK"]);

export const onboardingPlanSchema = onboardingVersionSchema.extend({
  selectedPlanCode: onboardingPlanCodeSchema
});

export const onboardingReviewSchema = onboardingVersionSchema.extend({
  confirmAccuracy: z.literal(true)
});

export const completeOnboardingSchema = onboardingVersionSchema.extend({
  confirmAccuracy: z.literal(true)
});

export const cancelOnboardingSchema = onboardingVersionSchema.extend({
  reason: optionalTrimmedString(160)
});

export const onboardingPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  businessType: onboardingBusinessTypeDataSchema.optional(),
  company: onboardingCompanyDataSchema.optional(),
  unit: onboardingUnitSchema.omit({ version: true }).optional(),
  responsible: onboardingResponsibleSchema.omit({ version: true }).optional(),
  operation: onboardingOperationSchema.omit({ version: true }).optional(),
  plan: onboardingPlanSchema.omit({ version: true }).optional(),
  review: onboardingReviewSchema.omit({ version: true }).optional()
});

export const completeOnboardingPayloadSchema = onboardingPayloadSchema
  .extend({
    businessType: onboardingBusinessTypeDataSchema,
    company: onboardingCompanyDataSchema,
    unit: onboardingUnitSchema.omit({ version: true }),
    responsible: onboardingResponsibleSchema.omit({ version: true }),
    operation: onboardingOperationSchema.omit({ version: true }),
    plan: onboardingPlanSchema.omit({ version: true }),
    review: onboardingReviewSchema.omit({ version: true })
  })
  .superRefine((value, context) => {
    if (value.businessType.type !== "PERSONAL" && !value.company.cnpj) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["company", "cnpj"],
        message: "CNPJ e obrigatorio para academias e redes."
      });
    }
  });

export type OnboardingBusinessTypeInput = z.infer<typeof onboardingBusinessTypeSchema>;
export type OnboardingCompanyInput = z.infer<typeof onboardingCompanySchema>;
export type OnboardingUnitInput = z.infer<typeof onboardingUnitSchema>;
export type OnboardingResponsibleInput = z.infer<typeof onboardingResponsibleSchema>;
export type OnboardingOperationInput = z.infer<typeof onboardingOperationSchema>;
export type OnboardingPlanInput = z.infer<typeof onboardingPlanSchema>;
export type OnboardingReviewInput = z.infer<typeof onboardingReviewSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type CancelOnboardingInput = z.infer<typeof cancelOnboardingSchema>;
export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;
