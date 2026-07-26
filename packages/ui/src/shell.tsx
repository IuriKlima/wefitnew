"use client";

import { useState, type ReactNode } from "react";

import { Drawer } from "./overlays.js";
import { IconButton, SearchInput, WefitIcon, type IconName } from "./primitives.js";
import { joinClassNames } from "./utils.js";

export type NavigationItem = {
  href: string;
  icon: IconName;
  isActive?: boolean;
  label: string;
};

export function Sidebar({
  collapsed,
  items,
  onCollapse,
  onNavigate
}: {
  collapsed: boolean;
  items: NavigationItem[];
  onCollapse: () => void;
  onNavigate?: () => void;
}) {
  return (
    <aside className={joinClassNames("wf-sidebar", collapsed && "wf-sidebar--collapsed")}>
      <div className="wf-sidebar-brand">
        <a href="/" aria-label="Wefit — início">
          <span aria-hidden="true">W</span>
          <strong>Wefit</strong>
        </a>
        <IconButton
          className="wf-sidebar-collapse"
          icon="panel"
          label={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={onCollapse}
        />
      </div>
      <nav aria-label="Navegação principal">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <WefitIcon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <small>Gestão clara. Operação segura.</small>
    </aside>
  );
}

export function Topbar({
  contextSelector,
  onOpenMenu,
  profile,
  searchAction = "/students"
}: {
  contextSelector: ReactNode;
  onOpenMenu: () => void;
  profile: ReactNode;
  searchAction?: string;
}) {
  return (
    <header className="wf-topbar">
      <IconButton className="wf-mobile-menu" icon="menu" label="Abrir menu" onClick={onOpenMenu} />
      <div className="wf-topbar-context">{contextSelector}</div>
      <form className="wf-global-search" action={searchAction} role="search">
        <SearchInput name="search" aria-label="Pesquisar alunos" placeholder="Pesquisar alunos" />
      </form>
      <div className="wf-topbar-actions">
        <IconButton icon="bell" label="Notificações — em breve" disabled />
        {profile}
      </div>
    </header>
  );
}

export function AppShell({
  children,
  contextSelector,
  navigation,
  profile
}: {
  children: ReactNode;
  contextSelector: ReactNode;
  navigation: NavigationItem[];
  profile: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={joinClassNames("wf-app-shell", collapsed && "wf-app-shell--collapsed")}
      data-testid="wefit-app-shell"
    >
      <div className="wf-desktop-sidebar">
        <Sidebar
          collapsed={collapsed}
          items={navigation}
          onCollapse={() => setCollapsed((value) => !value)}
        />
      </div>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} label="Menu principal">
        <Sidebar
          collapsed={false}
          items={navigation}
          onCollapse={() => setMobileOpen(false)}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
      <div className="wf-workspace">
        <Topbar
          contextSelector={contextSelector}
          onOpenMenu={() => setMobileOpen(true)}
          profile={profile}
        />
        {children}
      </div>
    </div>
  );
}
