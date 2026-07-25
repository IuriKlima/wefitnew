import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";
import { AdminApiError, getAdminAccountState } from "./lib/admin-api";
import { readAdminAuthAdapter } from "./lib/admin-auth";
import "@gym-platform/ui/tokens.css";
import "@gym-platform/ui/components.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "Wefit",
  description: "Gestao multiacademia"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const accountState = await readOptionalAccountState();
  const usesSupabaseAuth = readAdminAuthAdapter() === "supabase-jwt";

  return (
    <html lang="pt-BR">
      <body>
        <AppShell accountState={accountState} usesSupabaseAuth={usesSupabaseAuth}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

async function readOptionalAccountState() {
  try {
    return await getAdminAccountState();
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 401) {
      return null;
    }

    throw error;
  }
}
