"use client";

// figma: node-id=3779:4846
import clsx from "clsx";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "../atoms/Button";

/**
 * Organism/SidePanel — Figma "Te doen/Mobile/AddItem" (3779:4846) + its
 * desktop pair (3779:4938, broken layer name "y"). Same panel, two shapes
 * via `md:` only (annotations 3779:4847/3878:9048 "Slides in from bottom",
 * 3779:4939/3878:9061 "Slides in from right") — never JS breakpoint
 * detection. Empty shell: `children` (fields) + `footer` (actions) are
 * composer-supplied, per #89 — no field/data logic here (that's #94).
 * `title` is required (not optional, unlike the ticket's own proposal) so
 * `aria-labelledby` always resolves; full rationale + gaps: design/notes/SidePanel.md.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface SidePanelProps {
  /** Whether the panel is open. Stays mounted (but `inert`) while closed so both directions can transition. */
  open: boolean;
  /** Fired on overlay click, Escape, and the close button. */
  onClose: () => void;
  /** Accessible name (`aria-labelledby`) — rendered visually hidden; Figma's fetched node has no visible title text. */
  title: string;
  /** The fields — composer-supplied, no assumption made about their shape. */
  children: ReactNode;
  /** The action buttons (Figma "Bottom" — Destructive+Filled on AddItem, Filled only on AddBoard). Omit to render no footer strip at all. */
  footer?: ReactNode;
  /** Accessible name for the icon-only close button. */
  closeLabel: string;
  className?: string;
}

export function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  className,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Move focus into the panel on open, back to whatever triggered it on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      getFocusable(panelRef.current)[0]?.focus();
    } else {
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {/* GAP: reuses `text` (stone-950, matches Figma's rgba(12,10,9,0.6) exactly
          in light mode) since no dedicated scrim token exists — flagged, not
          invented. `text` flips to white in dark mode, which would invert this
          to a light scrim; see design/notes/SidePanel.md. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-40 bg-text/60 transition-opacity duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={handleKeyDown}
        className={clsx(
          "fixed z-50 flex flex-col overflow-hidden bg-surface-muted transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          // Corner radii are 16/12, not a uniform value on either shape —
          // Figma reports "16px 12px 0px 0px" (mobile) / "16px 0px 0px 12px"
          // (desktop); see design/notes/SidePanel.md.
          "inset-x-0 bottom-0 max-h-[90vh] rounded-tl-2xl rounded-tr-xl",
          "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:max-h-none md:w-[400px] md:rounded-tr-none md:rounded-bl-xl",
          open
            ? "translate-x-0 translate-y-0"
            : "translate-y-full md:translate-x-full md:translate-y-0",
          className,
        )}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <div className="relative flex h-14 shrink-0 items-center justify-end px-4">
          {/* Decorative pull-handle (Figma: no swipe-to-close modeled) — mobile only. */}
          <span
            aria-hidden="true"
            className="absolute top-3 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-border md:hidden"
          />
          <Button variant="filled" icon="X" aria-label={closeLabel} onClick={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface p-4 md:border-t-0 md:bg-transparent">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
