"use client";

import { useState, type ReactNode } from "react";

import { Drawer } from "./overlays.js";
import {
  IconButton,
  SearchInput,
  StatusBadge,
  WefitIcon,
  type IconName,
  type StatusTone
} from "./primitives.js";
import { joinClassNames } from "./utils.js";

export type NavigationItem = {
  badge?: string;
  badgeTone?: StatusTone;
  description?: string;
  href: string;
  icon: IconName;
  isActive?: boolean;
  label: string;
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

export function Sidebar({
  collapsed,
  sections,
  onCollapse,
  onNavigate
}: {
  collapsed: boolean;
  sections: NavigationSection[];
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
        {sections.map((section) => (
          <SidebarSection
            collapsed={collapsed}
            items={section.items}
            key={section.id}
            label={section.label}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ))}
      </nav>
      <small>Gestão clara. Operação segura.</small>
    </aside>
  );
}

export function SidebarSection({
  collapsed,
  items,
  label,
  onNavigate
}: {
  collapsed: boolean;
  items: NavigationItem[];
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <section className="wf-sidebar-section" aria-label={label}>
      <span className="wf-sidebar-section__label" aria-hidden={collapsed || undefined}>
        {label}
      </span>
      <div>
        {items.map((item) => (
          <SidebarItem
            collapsed={collapsed}
            item={item}
            key={item.href}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ))}
      </div>
    </section>
  );
}

export function SidebarItem({
  collapsed,
  item,
  onNavigate
}: {
  collapsed: boolean;
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={item.href}
      aria-current={item.isActive ? "page" : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      <WefitIcon name={item.icon} />
      <span className="wf-sidebar-item__copy">
        <span>{item.label}</span>
        {item.description ? <small>{item.description}</small> : null}
      </span>
      {item.badge ? (
        <StatusBadge {...(item.badgeTone ? { tone: item.badgeTone } : {})}>
          {item.badge}
        </StatusBadge>
      ) : null}
    </a>
  );
}

export function MobileNavigation({
  onClose,
  open,
  sections
}: {
  onClose: () => void;
  open: boolean;
  sections: NavigationSection[];
}) {
  return (
    <Drawer open={open} onClose={onClose} label="Menu principal">
      <Sidebar collapsed={false} sections={sections} onCollapse={onClose} onNavigate={onClose} />
    </Drawer>
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
  navigation: NavigationSection[];
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
          sections={navigation}
          onCollapse={() => setCollapsed((value) => !value)}
        />
      </div>
      <MobileNavigation
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sections={navigation}
      />
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
