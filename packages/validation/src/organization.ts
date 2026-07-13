import { z } from "zod";

import { nonEmptyTrimmedString } from "./common.js";

export const organizationTypeSchema = z.enum(["PERSONAL", "GYM", "NETWORK"]);

export const createOrganizationSchema = z.object({
  type: organizationTypeSchema,
  legalName: nonEmptyTrimmedString.max(160),
  tradeName: z.string().trim().max(120).optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  defaultUnitName: z.string().trim().max(120).optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
