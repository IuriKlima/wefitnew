export type AdminAuthAdapter = "supabase-jwt" | "temporary-header";

const temporaryHeaderEnvironments = new Set(["development", "test"]);

export function readAdminAuthAdapter(): AdminAuthAdapter {
  const environment = process.env.NODE_ENV ?? "development";
  const adapter =
    process.env.ADMIN_AUTH_ADAPTER ||
    (temporaryHeaderEnvironments.has(environment) ? "temporary-header" : "supabase-jwt");

  if (adapter !== "supabase-jwt" && adapter !== "temporary-header") {
    throw new Error("ADMIN_AUTH_ADAPTER deve ser supabase-jwt ou temporary-header.");
  }

  if (adapter === "temporary-header" && !temporaryHeaderEnvironments.has(environment)) {
    throw new Error(
      "Autenticacao administrativa temporaria permitida apenas em desenvolvimento e teste."
    );
  }

  return adapter;
}

export function requireSupabasePublicConfig(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar supabase-jwt."
    );
  }
}

export function readSafeNextPath(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.startsWith("/login")
  ) {
    return "/students";
  }

  return candidate;
}
