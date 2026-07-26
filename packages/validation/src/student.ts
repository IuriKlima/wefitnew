import { z } from "zod";

import { nonEmptyTrimmedString, uuidSchema } from "./common.js";

export const studentStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const optionalNullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value));

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) {
      return value === "" ? null : value;
    }

    return value.replace(/\s+/g, " ");
  });

const optionalBirthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidPastOrPresentDate, {
    message: "Birth date must be a valid date that is not in the future."
  })
  .optional()
  .nullable();

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .optional()
  .nullable()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().email().max(254).nullable().optional())
  .transform((value) => (typeof value === "string" ? value.toLowerCase() : value));

const unitIdsSchema = z.array(uuidSchema).max(50);

const studentDetailsSchema = z.object({
  userId: uuidSchema.optional().nullable(),
  name: nonEmptyTrimmedString.max(160),
  socialName: optionalNullableTrimmedString(160),
  email: emailSchema,
  phone: optionalPhoneSchema,
  birthDate: optionalBirthDateSchema,
  operationalNote: optionalNullableTrimmedString(500)
});

export const createStudentSchema = studentDetailsSchema.extend({
  organizationId: uuidSchema,
  unitIds: unitIdsSchema.optional().default([]),
  status: studentStatusSchema.optional().default("ACTIVE")
});

export const updateStudentSchema = studentDetailsSchema.partial().refine(
  (value) => {
    return Object.keys(value).length > 0;
  },
  {
    message: "At least one field is required."
  }
);

export const replaceStudentUnitsSchema = z.object({
  unitIds: unitIdsSchema
});

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: studentStatusSchema.optional(),
  unitId: uuidSchema.optional(),
  sortBy: z.enum(["name", "status", "createdAt", "updatedAt"]).default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc")
});

export type StudentStatusInput = z.infer<typeof studentStatusSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ReplaceStudentUnitsInput = z.infer<typeof replaceStudentUnitsSchema>;
export type ListStudentsQueryInput = z.infer<typeof listStudentsQuerySchema>;

function isValidPastOrPresentDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return date.getTime() <= todayUtc;
}
