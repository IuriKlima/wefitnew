"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeActiveContextSelection } from "../lib/active-context";
import { getCurrentAccountContext } from "../lib/admin-api";
import { readSafeNextPath } from "../lib/admin-auth";

export async function selectActiveOrganizationAction(formData: FormData): Promise<void> {
  const context = await getCurrentAccountContext();
  const organizationId = requiredString(formData, "organizationId");
  const organization = context.organizations.find(({ id }) => id === organizationId);

  if (!organization) {
    throw new Error("A organizacao selecionada nao pertence ao usuario autenticado.");
  }

  const defaultUnit = organization.isGlobalMember ? undefined : organization.units[0];
  await writeActiveContextSelection(organization.id, defaultUnit?.id);
  finishSelection(formData);
}

export async function selectActiveUnitAction(formData: FormData): Promise<void> {
  const context = await getCurrentAccountContext();
  const organizationId = requiredString(formData, "organizationId");
  const unitId = optionalString(formData, "unitId");
  const organization = context.organizations.find(({ id }) => id === organizationId);

  if (!organization) {
    throw new Error("A organizacao ativa nao pertence ao usuario autenticado.");
  }

  if (!unitId && !organization.isGlobalMember) {
    throw new Error("Uma unidade permitida deve ser selecionada.");
  }

  if (unitId && !organization.units.some(({ id }) => id === unitId)) {
    throw new Error("A unidade selecionada nao pertence ao escopo do usuario autenticado.");
  }

  await writeActiveContextSelection(organization.id, unitId);
  finishSelection(formData);
}

function finishSelection(formData: FormData): never {
  revalidatePath("/", "layout");
  redirect(readSafeNextPath(optionalString(formData, "returnTo")));
}

function requiredString(formData: FormData, key: string): string {
  const value = optionalString(formData, key);

  if (!value) {
    throw new Error(`Campo obrigatorio ausente: ${key}.`);
  }

  return value;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
