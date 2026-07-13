import { SetMetadata } from "@nestjs/common";

import { REQUIRED_PERMISSION_SCOPE, type PermissionScope } from "./auth.constants.js";

export const RequireOrganizationScope = () =>
  SetMetadata(REQUIRED_PERMISSION_SCOPE, "organization" satisfies PermissionScope);
