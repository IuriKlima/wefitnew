import { z } from "zod";

import { nonEmptyTrimmedString, uuidSchema } from "./common.js";

export const createUnitSchema = z.object({
  organizationId: uuidSchema,
  name: nonEmptyTrimmedString.max(120),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]+$/)
    .max(40)
    .optional(),
  timezone: z.string().trim().min(1).max(80).optional()
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
