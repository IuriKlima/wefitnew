import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { readAdminAuthAdapter } from "./lib/admin-auth";
import { logoutAction } from "./logout/actions";
import "./styles.css";

export const metadata: Metadata = {
  title: "Gym Management Platform",
  description: "Fundacao do SaaS multi-tenant para academias"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const usesSupabaseAuth = readAdminAuthAdapter() === "supabase-jwt";

  return (
    <html lang="pt-BR">
      <body>
        <div className="admin-shell">
          <aside className="sidebar" aria-label="Navegacao principal">
            <Link className="brand" href="/students">
              Gym Platform
            </Link>
            <nav className="nav-list">
              <Link href="/students">Alunos</Link>
            </nav>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <div>
                <span className="topbar-kicker">Administrativo</span>
                <strong>Gestao operacional</strong>
              </div>
              {usesSupabaseAuth ? (
                <form action={logoutAction}>
                  <button className="button button-small" type="submit">
                    Sair
                  </button>
                </form>
              ) : null}
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
