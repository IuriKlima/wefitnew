import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "@gym-platform/permissions";

import { REQUIRED_PERMISSIONS } from "./auth.constants.js";

export const RequirePermissions = (...permissions: Array<PermissionKey | string>) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
