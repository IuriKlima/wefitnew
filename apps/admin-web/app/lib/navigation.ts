import type { ActiveAccountContext } from "@gym-platform/contracts";
import type { NavigationSection } from "@gym-platform/ui";

import {
  buildModuleNavigation,
  getAdminModule,
  hasPermissionInActiveScope,
  resolveAdminModuleAccess
} from "./module-catalog";

const studentManagePermission = "student:manage";

export function buildAdminNavigation(
  active: ActiveAccountContext,
  pathname: string
): NavigationSection[] {
  return buildModuleNavigation(active, pathname);
}

export function canAccessStudents(active: ActiveAccountContext): boolean {
  const access = resolveAdminModuleAccess(getAdminModule("students"), active);
  return access.visible && access.state === "available";
}

export function canManageStudents(active: ActiveAccountContext): boolean {
  return (
    canAccessStudents(active) &&
    active.organization.permissions.organization.includes(studentManagePermission)
  );
}

export { hasPermissionInActiveScope };
