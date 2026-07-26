import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { getPaginationItems } from "./data-display.js";
import { PageHeader, PermissionBoundary } from "./layout.js";
import { StatusBadge, WefitIcon } from "./primitives.js";

describe("Wefit design system", () => {
  it("keeps pagination bounded around the current page", () => {
    expect(getPaginationItems(1, 3)).toEqual([1, 2, 3]);
    expect(getPaginationItems(6, 12)).toEqual([4, 5, 6, 7, 8]);
    expect(getPaginationItems(12, 12)).toEqual([8, 9, 10, 11, 12]);
  });

  it("maps status tone to a visible semantic class", () => {
    const element = StatusBadge({ children: "Ativo", tone: "success" });

    expect((element.props as { className: string }).className).toContain(
      "wf-status-badge--success"
    );
  });

  it("exposes reusable page, permission and module icon primitives", () => {
    const header = PageHeader({ title: "Alunos", eyebrow: "Operação" });
    const allowed = PermissionBoundary({
      allowed: true,
      children: "conteúdo",
      fallback: "bloqueado"
    });
    const blocked = PermissionBoundary({
      allowed: false,
      children: "conteúdo",
      fallback: "bloqueado"
    });
    const icon = WefitIcon({ name: "team" });

    expect((header.props as { className: string }).className).toBe("wf-page-header");
    expect(allowed).toBe("conteúdo");
    expect(blocked).toBe("bloqueado");
    expect(icon.type).toBe("svg");
  });

  it("centralizes required colors, target size, focus and reduced motion", async () => {
    const [tokens, components] = await Promise.all([
      readFile("src/tokens.css", "utf8"),
      readFile("src/components.css", "utf8")
    ]);

    expect(tokens).toContain("--wf-color-background: #f5f5f7");
    expect(tokens).toContain("--wf-color-surface: #ffffff");
    expect(tokens).toContain("--wf-color-text-primary: #1d1d1f");
    expect(tokens).toContain("--wf-color-brand-primary: #22b573");
    expect(tokens).toContain("--wf-control-height: 44px");
    expect(components).toContain("box-shadow: var(--wf-focus-ring)");
    expect(components).toContain("contain: layout inline-size");
    expect(components).toContain(".wf-page-header");
    expect(components).toContain(".wf-mobile-data-cards");
    expect(components).toContain(".wf-sidebar-section");
    expect(components).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
