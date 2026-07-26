"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell as WefitAppShell, Avatar, Button, DropdownMenu } from "@gym-platform/ui";

import { ContextSelector } from "./context/context-selector";
import type { AdminAccountState } from "./lib/admin-api";
import { buildAdminNavigation } from "./lib/navigation";
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

  const navigation = buildAdminNavigation(accountState.active, pathname);

  return (
    <WefitAppShell
      contextSelector={<ContextSelector state={accountState} />}
      navigation={navigation}
      profile={
        <DropdownMenu
          label="Menu da conta"
          trigger={
            <span className="profile-trigger">
              <Avatar name={accountState.context.user.name ?? "Conta Wefit"} />
              <span>
                <strong>{accountState.context.user.name ?? "Conta sem perfil"}</strong>
                <small>{accountState.active.organization.name}</small>
              </span>
            </span>
          }
        >
          <div className="profile-menu-summary">
            <strong>{accountState.context.user.name ?? "Conta Wefit"}</strong>
            <span>{accountState.active.organization.name}</span>
          </div>
          {usesSupabaseAuth ? (
            <form action={logoutAction}>
              <Button size="small" type="submit">
                Sair com segurança
              </Button>
            </form>
          ) : (
            <span className="profile-dev-session">Sessão local de desenvolvimento</span>
          )}
        </DropdownMenu>
      }
    >
      {children}
    </WefitAppShell>
  );
}

export function isStandaloneAppRoute(pathname: string): boolean {
  return ["/auth", "/legal", "/login", "/onboarding", "/signup", "/suspended"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
