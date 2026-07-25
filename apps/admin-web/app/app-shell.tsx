"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ContextSelector } from "./context/context-selector";
import type { AdminAccountState } from "./lib/admin-api";
import { logoutAction } from "./logout/actions";

type AppShellProps = {
  accountState: AdminAccountState | null;
  children: ReactNode;
  usesSupabaseAuth: boolean;
};

export function AppShell({ accountState, children, usesSupabaseAuth }: AppShellProps) {
  const pathname = usePathname();

  if (
    isStandaloneAppRoute(pathname) ||
    !accountState ||
    accountState.active?.organization.lifecycle !== "ACTIVE"
  ) {
    return children;
  }

  return (
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
  );
}

export function isStandaloneAppRoute(pathname: string): boolean {
  return ["/auth", "/legal", "/login", "/onboarding", "/signup", "/suspended"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
