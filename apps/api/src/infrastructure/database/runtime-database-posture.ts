export type RuntimeDatabasePosture = {
  isSuperuser: boolean;
  bypassesRls: boolean;
  inheritedElevatedRoleCount: number;
  ownedBusinessTableCount: number;
};

export function assertSafeRuntimeDatabasePosture(posture: RuntimeDatabasePosture): void {
  if (
    posture.isSuperuser ||
    posture.bypassesRls ||
    posture.inheritedElevatedRoleCount > 0 ||
    posture.ownedBusinessTableCount > 0
  ) {
    throw new Error(
      "Unsafe runtime database role: production API requires a non-owner role without superuser or BYPASSRLS privileges."
    );
  }
}
