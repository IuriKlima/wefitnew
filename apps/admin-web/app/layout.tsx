import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ContextSelector } from "./context/context-selector";
import { AdminApiError, getAdminAccountState } from "./lib/admin-api";
import { readAdminAuthAdapter } from "./lib/admin-auth";
import { logoutAction } from "./logout/actions";
import "./styles.css";

export const metadata: Metadata = {
  title: "Wefit",
  description: "Gestao multiacademia"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const accountState = await readOptionalAccountState();

  if (!accountState) {
    return (
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    );
  }

  const usesSupabaseAuth = readAdminAuthAdapter() === "supabase-jwt";

  return (
    <html lang="pt-BR">
      <body>
        <div className="admin-shell">
          <aside className="sidebar" aria-label="Navegacao principal">
            <Link className="brand" href="/">
              Wefit
            </Link>
            <nav className="nav-list">
              <Link href="/">Inicio</Link>
              {accountState.active ? <Link href="/students">Alunos</Link> : null}
            </nav>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <ContextSelector state={accountState} />
              <div className="account-actions">
                <span>{accountState.context.user.name ?? "Conta sem perfil"}</span>
                {usesSupabaseAuth ? (
                  <form action={logoutAction}>
                    <button className="button button-small" type="submit">
                      Sair
                    </button>
                  </form>
                ) : null}
              </div>
            </header>
            {children}
          </div>
        </div>
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
