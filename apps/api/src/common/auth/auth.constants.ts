export const AUTH_ADAPTER = Symbol("AUTH_ADAPTER");
export const IS_PUBLIC_ROUTE = Symbol("IS_PUBLIC_ROUTE");
export const REQUIRED_PERMISSIONS = Symbol("REQUIRED_PERMISSIONS");
export const REQUIRED_PERMISSION_SCOPE = Symbol("REQUIRED_PERMISSION_SCOPE");

export type PermissionScope = "contextual" | "organization";
