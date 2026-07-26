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
  | "access"
  | "assessments"
  | "audit"
  | "bell"
  | "building"
  | "calendar"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "crm"
  | "exercises"
  | "finance"
  | "home"
  | "integrations"
  | "lock"
  | "menu"
  | "panel"
  | "plans"
  | "search"
  | "settings"
  | "students"
  | "team"
  | "workouts";

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
    case "access":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      );
    case "assessments":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
          <path d="m4 6 6-3 6 5 5-4" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" />
          <path d="m9 14 2 2 4-5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M7 9a5 5 0 0 1 10 0c0 6 2 6 2 7H5c0-1 2-1 2-7Z" />
          <path d="M10 20h4" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <path d="M4 21V5l8-3v19M12 8h8v13M2 21h20" />
          <path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3" />
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
    case "crm":
      return (
        <svg {...common}>
          <path d="M4 5h5v5H4zM15 5h5v5h-5zM9.5 15h5v5h-5z" />
          <path d="M6.5 10v2h5.5v3M17.5 10v2H12" />
        </svg>
      );
    case "exercises":
      return (
        <svg {...common}>
          <path d="M6 9v6M3 10v4M18 9v6M21 10v4M6 12h12" />
        </svg>
      );
    case "finance":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M3 9h18M7 15h4" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M6.5 10.5V20h11v-9.5M10 20v-6h4v6" />
        </svg>
      );
    case "integrations":
      return (
        <svg {...common}>
          <path d="M8 8h-2a3 3 0 0 0 0 6h2M16 8h2a3 3 0 0 1 0 6h-2" />
          <path d="M8 12h8M12 8V4M12 20v-4" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
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
    case "plans":
      return (
        <svg {...common}>
          <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L2.6 6l.9 1.9-.8 1.9-2 .7v3l2 .7.8 1.9-.9 1.9 2.1 2.1 1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9 2-.7Z" />
        </svg>
      );
    case "students":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 3.5 4.8" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4.5 4.5 0 0 1 8.5-2" />
        </svg>
      );
    case "workouts":
      return (
        <svg {...common}>
          <path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h7" />
          <path d="M9 2v4M15 2v4" />
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

export const SearchField = SearchInput;

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
