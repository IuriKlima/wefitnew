import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";

import { joinClassNames } from "./utils.js";

export type ButtonTone = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "small" | "medium";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  size?: ButtonSize;
  tone?: ButtonTone;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    loading = false,
    size = "medium",
    tone = "secondary",
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClassNames("wf-button", `wf-button--${tone}`, `wf-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="wf-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export type IconName =
  | "bell"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "home"
  | "menu"
  | "panel"
  | "search"
  | "students";

export function WefitIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    "aria-hidden": true,
    className: "wf-icon",
    fill: "none",
    height: size,
    viewBox: "0 0 24 24",
    width: size
  } as const;

  switch (name) {
    case "bell":
      return (
        <svg {...common}>
          <path d="M7 9a5 5 0 0 1 10 0c0 6 2 6 2 7H5c0-1 2-1 2-7Z" />
          <path d="M10 20h4" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M6.5 10.5V20h11v-9.5M10 20v-6h4v6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "students":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 3.5 4.8" />
        </svg>
      );
  }
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, icon, label, type = "button", ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClassNames("wf-icon-button", className)}
      aria-label={label}
      title={props.title ?? label}
    >
      <WefitIcon name={icon} />
    </button>
  );
});

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section {...props} className={joinClassNames("wf-card", className)}>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  description?: string;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  return (
    <article className={joinClassNames("wf-metric-card", `wf-metric-card--${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {description ? <small>{description}</small> : null}
    </article>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input {...props} ref={ref} className={joinClassNames("wf-input", className)} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select {...props} ref={ref} className={joinClassNames("wf-select", className)}>
        {children}
      </select>
    );
  }
);

export function FormField({
  children,
  error,
  hint,
  id,
  label,
  required
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  const descriptionId = error || hint ? `${id}-description` : undefined;

  return (
    <div className="wf-form-field" data-invalid={error ? "true" : undefined}>
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error || hint ? (
        <small id={descriptionId} className={error ? "wf-field-error" : undefined}>
          {error ?? hint}
        </small>
      ) : null}
    </div>
  );
}

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, placeholder = "Pesquisar", ...props }, ref) {
    return (
      <span className={joinClassNames("wf-search-input", className)}>
        <WefitIcon name="search" size={18} />
        <input {...props} ref={ref} type="search" placeholder={placeholder} />
      </span>
    );
  }
);

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={joinClassNames("wf-status-badge", `wf-status-badge--${tone}`)}>
      {children}
    </span>
  );
}
