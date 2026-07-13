import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const className = `status-badge status-badge--${tone}`;

  return <span className={className}>{children}</span>;
}
