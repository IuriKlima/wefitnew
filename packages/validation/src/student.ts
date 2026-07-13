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

const optionalBirthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .optional()
  .nullable()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().email().max(254).nullable().optional());

const unitIdsSchema = z.array(uuidSchema).max(50);

export const createStudentSchema = z.object({
  organizationId: uuidSchema,
  userId: uuidSchema.optional().nullable(),
  unitIds: unitIdsSchema.optional().default([]),
  name: nonEmptyTrimmedString.max(160),
  socialName: optionalNullableTrimmedString(160),
  email: emailSchema,
  phone: optionalNullableTrimmedString(40),
  birthDate: optionalBirthDateSchema,
  operationalNote: optionalNullableTrimmedString(500),
  status: studentStatusSchema.optional().default("ACTIVE")
});

export const updateStudentSchema = createStudentSchema
  .omit({
    organizationId: true
  })
  .extend({
    unitIds: unitIdsSchema.optional()
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required."
  });

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: studentStatusSchema.optional()
});

export type StudentStatusInput = z.infer<typeof studentStatusSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQueryInput = z.infer<typeof listStudentsQuerySchema>;
