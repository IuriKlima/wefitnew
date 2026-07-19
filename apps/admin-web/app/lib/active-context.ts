import { cookies } from "next/headers";

import type { ActiveAccountContext, CurrentAccountContext } from "@gym-platform/contracts";

export const activeOrganizationCookie = "wefit_active_organization";
export const activeUnitCookie = "wefit_active_unit";

export type ActiveContextSelection = {
  organizationId?: string;
  unitId?: string;
};

export async function readActiveContextSelection(): Promise<ActiveContextSelection> {
  const cookieStore = await cookies();
  const organizationId = cookieStore.get(activeOrganizationCookie)?.value;
  const unitId = cookieStore.get(activeUnitCookie)?.value;

  return {
    ...(organizationId ? { organizationId } : {}),
    ...(unitId ? { unitId } : {})
  };
}

export function resolveActiveAccountContext(
  context: CurrentAccountContext,
  selection: ActiveContextSelection
): ActiveAccountContext | null {
  const organization =
    context.organizations.find(({ id }) => id === selection.organizationId) ??
    context.organizations[0];

  if (!organization) {
    return null;
  }

  const selectedUnit = organization.units.find(({ id }) => id === selection.unitId);
  const unit = selectedUnit ?? (organization.isGlobalMember ? undefined : organization.units[0]);

  return {
    organization,
    ...(unit ? { unit } : {})
  };
}
