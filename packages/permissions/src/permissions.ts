export const permissionKeys = {
  organizationRead: "organization:read",
  organizationManage: "organization:manage",
  unitRead: "unit:read",
  unitManage: "unit:manage",
  studentRead: "student:read",
  studentManage: "student:manage",
  membershipManage: "membership:manage",
  subscriptionRead: "subscription:read",
  auditRead: "audit:read"
} as const;

export type PermissionKey = (typeof permissionKeys)[keyof typeof permissionKeys];

export type PermissionAssignment = {
  permission: PermissionKey | string;
  unitId?: string | null;
};

export type PermissionContext = {
  unitId?: string;
};

export function hasPermission(
  assignments: PermissionAssignment[],
  permission: PermissionKey | string,
  context: PermissionContext = {}
): boolean {
  return assignments.some((assignment) => {
    if (assignment.permission !== permission) {
      return false;
    }

    if (!assignment.unitId) {
      return true;
    }

    return assignment.unitId === context.unitId;
  });
}

export function listDefaultOwnerPermissions(): PermissionKey[] {
  return Object.values(permissionKeys);
}
