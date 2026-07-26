import type { HTMLAttributes, ReactNode } from "react";

import { Breadcrumb, type BreadcrumbItem, Skeleton } from "./data-display.js";
import { StatusBadge, WefitIcon, type IconName, type StatusTone } from "./primitives.js";
import { joinClassNames } from "./utils.js";

export function PageHeader({
  actions,
  breadcrumb,
  description,
  eyebrow,
  title
}: {
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="wf-page-header">
      <div className="wf-page-header__copy">
        {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
        {eyebrow ? <span className="wf-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="wf-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function SectionCard({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <section {...props} className={joinClassNames("wf-section-card", className)}>
      {title || description || actions ? (
        <header className="wf-section-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="wf-section-card__content">{children}</div>
    </section>
  );
}

export function ActionCard({
  badge,
  description,
  disabled = false,
  href,
  icon,
  title
}: {
  badge?: { label: string; tone?: StatusTone };
  description: string;
  disabled?: boolean;
  href?: string;
  icon: IconName;
  title: string;
}) {
  const content = (
    <>
      <span className="wf-action-card__icon" aria-hidden="true">
        <WefitIcon name={icon} />
      </span>
      <span className="wf-action-card__copy">
        <span className="wf-action-card__title">
          <strong>{title}</strong>
          {badge ? (
            <StatusBadge {...(badge.tone ? { tone: badge.tone } : {})}>{badge.label}</StatusBadge>
          ) : null}
        </span>
        <span>{description}</span>
      </span>
      <WefitIcon name={disabled ? "lock" : "chevron-right"} size={18} />
    </>
  );

  if (!href || disabled) {
    return (
      <article className="wf-action-card" aria-disabled={disabled || undefined}>
        {content}
      </article>
    );
  }

  return (
    <a className="wf-action-card" href={href}>
      {content}
    </a>
  );
}

export function LoadingState({
  description = "Preparando as informações do seu contexto.",
  title = "Carregando"
}: {
  description?: string;
  title?: string;
}) {
  return (
    <section className="wf-loading-state" role="status" aria-live="polite">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Skeleton lines={3} label={title} />
    </section>
  );
}

export function LockedModuleState({
  action,
  description,
  title = "Módulo indisponível neste contexto"
}: {
  action?: ReactNode;
  description: string;
  title?: string;
}) {
  return (
    <ModuleState
      action={action}
      description={description}
      icon="lock"
      title={title}
      tone="warning"
    />
  );
}

export function ModuleUnavailableState({
  action,
  description = "A estrutura visual está pronta, mas a integração funcional será entregue em uma fase posterior.",
  title = "Integração funcional em breve"
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <ModuleState action={action} description={description} icon="panel" title={title} tone="info" />
  );
}

function ModuleState({
  action,
  description,
  icon,
  title,
  tone
}: {
  action?: ReactNode;
  description: string;
  icon: IconName;
  title: string;
  tone: "info" | "warning";
}) {
  return (
    <section
      className={joinClassNames("wf-module-state", `wf-module-state--${tone}`)}
      aria-labelledby={`module-state-${tone}`}
    >
      <span className="wf-module-state__icon" aria-hidden="true">
        <WefitIcon name={icon} />
      </span>
      <div>
        <StatusBadge tone={tone}>{tone === "warning" ? "Bloqueado" : "Preview seguro"}</StatusBadge>
        <h2 id={`module-state-${tone}`}>{title}</h2>
        <p>{description}</p>
        {action}
      </div>
    </section>
  );
}

export function Avatar({
  label,
  name,
  size = "medium"
}: {
  label?: string;
  name: string;
  size?: "small" | "medium";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={joinClassNames("wf-avatar", `wf-avatar--${size}`)}
      aria-label={label ?? name}
      role="img"
    >
      {initials || "W"}
    </span>
  );
}

export function DropdownMenu({
  children,
  label,
  trigger
}: {
  children: ReactNode;
  label: string;
  trigger: ReactNode;
}) {
  return (
    <details className="wf-dropdown">
      <summary aria-label={label}>{trigger}</summary>
      <div className="wf-dropdown__content" role="menu" aria-label={label}>
        {children}
      </div>
    </details>
  );
}

export function FormSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="wf-form-section" aria-labelledby={`form-section-${toSlug(title)}`}>
      <header>
        <h2 id={`form-section-${toSlug(title)}`}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

export function OrganizationSwitcher({ children }: { children: ReactNode }) {
  return (
    <ContextSwitcher label="Organização" description="Contexto organizacional ativo">
      {children}
    </ContextSwitcher>
  );
}

export function UnitSwitcher({ children }: { children: ReactNode }) {
  return (
    <ContextSwitcher label="Unidade" description="Escopo operacional ativo">
      {children}
    </ContextSwitcher>
  );
}

function ContextSwitcher({
  children,
  description,
  label
}: {
  children: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="wf-context-switcher">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {children}
    </div>
  );
}

export function PermissionBoundary({
  allowed,
  children,
  fallback = null
}: {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return allowed ? children : fallback;
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
