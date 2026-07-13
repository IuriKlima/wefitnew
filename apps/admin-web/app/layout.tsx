import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./styles.css";

export const metadata: Metadata = {
  title: "Gym Management Platform",
  description: "Fundacao do SaaS multi-tenant para academias"
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
