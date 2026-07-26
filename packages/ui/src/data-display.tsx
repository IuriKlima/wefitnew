import type { FormHTMLAttributes, ReactNode } from "react";

import { WefitIcon } from "./primitives.js";
import { joinClassNames } from "./utils.js";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function DataTable<T>({
  caption,
  columns,
  getRowKey,
  rows
}: {
  caption: string;
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T) => string;
  rows: T[];
}) {
  return (
    <div className="wf-data-table">
      <table>
        <caption className="wf-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-align={column.align}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type MobileDataCardField<T> = {
  key: string;
  label: string;
  value: (row: T) => ReactNode;
};

export function MobileDataCards<T>({
  fields,
  getRowKey,
  label,
  rows
}: {
  fields: Array<MobileDataCardField<T>>;
  getRowKey: (row: T) => string;
  label: string;
  rows: T[];
}) {
  return (
    <section className="wf-mobile-data-cards" aria-label={label}>
      {rows.map((row) => (
        <article key={getRowKey(row)}>
          {fields.map((field, index) => (
            <div key={field.key} data-primary={index === 0 ? "true" : undefined}>
              <span>{field.label}</span>
              <div>{field.value(row)}</div>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

export function getPaginationItems(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_value, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_value, index) => start + index);
}

export function Pagination({
  buildHref,
  currentPage,
  totalPages
}: {
  buildHref: (page: number) => string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="wf-pagination" aria-label="Paginação">
      <a
        href={buildHref(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : undefined}
      >
        <WefitIcon name="chevron-left" size={18} />
        <span className="wf-visually-hidden">Página anterior</span>
      </a>
      {getPaginationItems(currentPage, totalPages).map((page) => (
        <a
          key={page}
          href={buildHref(page)}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </a>
      ))}
      <a
        href={buildHref(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : undefined}
      >
        <WefitIcon name="chevron-right" size={18} />
        <span className="wf-visually-hidden">Próxima página</span>
      </a>
    </nav>
  );
}

export function FilterBar({
  children,
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return (
    <form {...props} className={joinClassNames("wf-filter-bar", className)}>
      {children}
    </form>
  );
}

export function EmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="wf-state" aria-labelledby="empty-state-title">
      <span className="wf-state-icon" aria-hidden="true">
        <WefitIcon name="students" />
      </span>
      <h2 id="empty-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({
  action,
  description = "Não foi possível carregar as informações. Tente novamente.",
  title = "Algo não saiu como esperado"
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <section className="wf-state wf-state--error" role="alert" aria-labelledby="error-state-title">
      <h2 id="error-state-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function Skeleton({
  lines = 3,
  label = "Carregando conteúdo"
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <div className="wf-skeleton" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_value, index) => (
        <span key={index} style={{ width: `${Math.max(45, 100 - index * 14)}%` }} />
      ))}
    </div>
  );
}

export type TabItem = {
  id: string;
  label: string;
  href: string;
};

export function Tabs({ activeId, items }: { activeId: string; items: TabItem[] }) {
  return (
    <nav className="wf-tabs" aria-label="Seções">
      {items.map((item) => (
        <a key={item.id} href={item.href} aria-current={item.id === activeId ? "page" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="wf-breadcrumb" aria-label="Navegação estrutural">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function StepProgress({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <ol className="wf-step-progress" aria-label="Progresso">
      {steps.map((step, index) => {
        const number = index + 1;
        const state = number < currentStep ? "done" : number === currentStep ? "current" : "next";
        return (
          <li key={step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span>{number}</span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

export const Stepper = StepProgress;
