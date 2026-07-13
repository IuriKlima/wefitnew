import { z } from "zod";

import { uuidSchema } from "./common.js";

export const tenantContextSchema = z.object({
  organizationId: uuidSchema,
  unitId: uuidSchema.optional()
});

export type TenantContextInput = z.infer<typeof tenantContextSchema>;
