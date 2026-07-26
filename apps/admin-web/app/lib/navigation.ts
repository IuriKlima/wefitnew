import { isFeatureEnabled, type ActiveAccountContext } from "@gym-platform/contracts";
import type { NavigationItem } from "@gym-platform/ui";

const studentsFeatureKey = "students.manage";
const studentReadPermission = "student:read";
const studentManagePermission = "student:manage";

export function buildAdminNavigation(
  active: ActiveAccountContext,
  pathname: string
): NavigationItem[] {
  const navigation: NavigationItem[] = [
    {
      href: "/",
      icon: "home",
      isActive: pathname === "/",
      label: "Início"
    }
  ];

  if (canAccessStudents(active)) {
    navigation.push({
      href: "/students",
      icon: "students",
      isActive: pathname === "/students" || pathname.startsWith("/students/"),
      label: "Alunos"
    });
  }

  return navigation;
}

export function canAccessStudents(active: ActiveAccountContext): boolean {
  if (!hasPermissionInActiveScope(active, studentReadPermission)) {
    return false;
  }

  const subscription = active.organization.subscription;
  return !subscription || isFeatureEnabled(subscription.features, studentsFeatureKey);
}

export function canManageStudents(active: ActiveAccountContext): boolean {
  return (
    canAccessStudents(active) &&
    active.organization.permissions.organization.includes(studentManagePermission)
  );
}

export function hasPermissionInActiveScope(
  active: ActiveAccountContext,
  permission: string
): boolean {
  const organizationPermissions = active.organization.permissions.organization;
  const unitPermissions = active.unit
    ? (active.organization.permissions.units[active.unit.id] ?? [])
    : [];

  return organizationPermissions.includes(permission) || unitPermissions.includes(permission);
}
