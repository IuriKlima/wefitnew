"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Button, IconButton } from "./primitives.js";
import { joinClassNames } from "./utils.js";

export function Modal({
  children,
  description,
  onClose,
  open,
  title
}: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogBehavior(open, onClose, dialogRef);

  if (!open) {
    return null;
  }

  return (
    <div className="wf-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="wf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={(event) => trapDialogFocus(event, dialogRef.current)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton icon="close" label="Fechar janela" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDialog({
  confirmLabel = "Confirmar",
  description,
  onCancel,
  onConfirm,
  open,
  pending = false,
  title,
  tone = "danger"
}: {
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending?: boolean;
  title: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} description={description}>
      <div className="wf-dialog-actions">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button tone={tone} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Drawer({
  children,
  label,
  onClose,
  open,
  side = "left"
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  open: boolean;
  side?: "left" | "right";
}) {
  const drawerRef = useRef<HTMLElement>(null);
  useDialogBehavior(open, onClose, drawerRef);

  if (!open) {
    return null;
  }

  return (
    <div className="wf-overlay wf-overlay--drawer" role="presentation" onMouseDown={onClose}>
      <aside
        className={joinClassNames("wf-drawer", `wf-drawer--${side}`)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={drawerRef}
        tabIndex={-1}
        onKeyDown={(event) => trapDialogFocus(event, drawerRef.current)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <IconButton
          className="wf-drawer-close"
          icon="close"
          label="Fechar menu"
          onClick={onClose}
        />
        {children}
      </aside>
    </div>
  );
}

function useDialogBehavior(
  open: boolean,
  onClose: () => void,
  containerRef: { current: HTMLElement | null }
): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const container = containerRef.current;
    const firstFocusable = container?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? container)?.focus();

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [containerRef, onClose, open]);
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function trapDialogFocus(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null): void {
  if (event.key !== "Tab" || !container) {
    return;
  }

  const focusable = [...container.querySelectorAll<HTMLElement>(focusableSelector)];
  const first = focusable[0];
  const last = focusable.at(-1);

  if (!first || !last) {
    event.preventDefault();
    container.focus();
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Toast({
  message,
  onClose,
  tone = "success"
}: {
  message: string;
  onClose?: () => void;
  tone?: "success" | "danger" | "info";
}) {
  return (
    <div
      className={joinClassNames("wf-toast", `wf-toast--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span>{message}</span>
      {onClose ? <IconButton icon="close" label="Fechar mensagem" onClick={onClose} /> : null}
    </div>
  );
}
