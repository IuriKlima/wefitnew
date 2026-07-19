"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { activeOrganizationCookie, activeUnitCookie } from "../lib/active-context";
import { getCurrentAccountContext } from "../lib/admin-api";
import { readSafeNextPath } from "../lib/admin-auth";

const cookieMaxAgeSeconds = 60 * 60 * 24 * 30;

export async function selectActiveOrganizationAction(formData: FormData): Promise<void> {
  const context = await getCurrentAccountContext();
  const organizationId = requiredString(formData, "organizationId");
  const organization = context.organizations.find(({ id }) => id === organizationId);

  if (!organization) {
    throw new Error("A organizacao selecionada nao pertence ao usuario autenticado.");
  }

  const defaultUnit = organization.isGlobalMember ? undefined : organization.units[0];
  await writeActiveContext(organization.id, defaultUnit?.id);
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

  await writeActiveContext(organization.id, unitId);
  finishSelection(formData);
}

async function writeActiveContext(organizationId: string, unitId?: string): Promise<void> {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    maxAge: cookieMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };

  cookieStore.set(activeOrganizationCookie, organizationId, options);
  if (unitId) {
    cookieStore.set(activeUnitCookie, unitId, options);
  } else {
    cookieStore.delete(activeUnitCookie);
  }
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
