"use client";

// figma: node-id=3779:4846
import clsx from "clsx";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Button } from "../atoms/Button";

/**
 * Organism/SidePanel — Figma "Te doen/Mobile/AddItem" (3779:4846) + its
 * desktop pair (3779:4938, broken layer name "y"). Same panel, two shapes
 * via `md:` only (annotations 3779:4847/3878:9048 "Slides in from bottom",
 * 3779:4939/3878:9061 "Slides in from right") — never JS breakpoint
 * detection for the *markup*. Empty shell: `children` (fields) + `footer`
 * (actions) are composer-supplied, per #89 — no field/data logic here
 * (that's #94). `title` is required (not optional, unlike the ticket's own
 * proposal) so `aria-labelledby` always resolves; full rationale + gaps:
 * design/notes/SidePanel.md.
 *
 * #103: the mobile-only drag-to-close *gesture* is real runtime behaviour
 * (not a markup shape), so it's the one deliberate exception to "no JS
 * breakpoint read" above — it checks `matchMedia` at drag-start, not on
 * every render, so it can't desync the two shapes' markup. Figma models no
 * gesture at all (design/notes/SidePanel.md).
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Drag-to-close tuning (#103, no Figma source — codebase decision, see
// design/notes/SidePanel.md). SLOP ignores a tap's own jitter before
// treating it as a real drag; DISTANCE requires a deliberate pull (not an
// accidental few-px nudge); VELOCITY lets a fast flick close even if
// released before crossing DISTANCE, matching the two conventional
// bottom-sheet dismiss triggers (far enough OR fast enough).
const DRAG_SLOP_PX = 8;
const DRAG_CLOSE_DISTANCE_PX = 120;
const DRAG_CLOSE_VELOCITY_PX_MS = 0.5; // 500px/s

interface DragState {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
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
  const dragRef = useRef<DragState | null>(null);
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

  // Mobile-only (<md) drag-to-close, starting in the handle strip only —
  // never the scrolling fields area, so it can't fight `overflow-y-auto`.
  // Imperative (direct style writes via panelRef, no React state) so the
  // drag stays smooth without a re-render per pointermove; the CSS
  // transition is disabled for the duration so it can't fight the live
  // transform, and restored on release/cancel.
  function handleHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!open) return;
    if (window.matchMedia("(min-width: 768px)").matches) return; // desktop keeps X/Escape/overlay-click only
    if ((event.target as HTMLElement).closest("button")) return; // never hijack the close button's own click
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
  }

  function handleHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.abs(deltaY) < DRAG_SLOP_PX) return;
      if (deltaY <= 0) {
        // Upward/sideways jitter in the handle strip isn't a close gesture.
        dragRef.current = null;
        return;
      }
      drag.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (panelRef.current) panelRef.current.style.transitionDuration = "0s";
    }
    const dt = event.timeStamp - drag.lastTime;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    if (panelRef.current) {
      panelRef.current.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }
    event.preventDefault();
  }

  // `cancelled` (pointercancel — the browser aborted the gesture, e.g. an OS
  // interruption) always snaps back regardless of distance/velocity; a
  // normal release (pointerup) evaluates the close thresholds.
  function endDrag(event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.dragging || !panelRef.current) return;
    const deltaY = event.clientY - drag.startY;
    const shouldClose =
      !cancelled &&
      (deltaY > DRAG_CLOSE_DISTANCE_PX || drag.velocity > DRAG_CLOSE_VELOCITY_PX_MS);
    panelRef.current.style.removeProperty("transition-duration");
    panelRef.current.style.removeProperty("transform");
    if (shouldClose) onClose();
  }

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
        <div
          className="relative flex h-14 shrink-0 touch-none items-center justify-end px-4 md:touch-auto"
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={(event) => endDrag(event, false)}
          onPointerCancel={(event) => endDrag(event, true)}
        >
          {/* Decorative-looking, but mobile (<md) it's also the drag-to-close
              handle strip's visual affordance — the gesture itself is bound
              to the whole strip, not just this span, so a drag starting
              anywhere in the empty header area also works. */}
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
          // Column, not row: imposes full width on whatever row(s) the
          // composer nests inside (default align-items:stretch), so a lone
          // button already fills 100% for free. Multiple buttons sharing a
          // row must still opt in per-button (`grow basis-0`, see
          // CardDetailPanel.tsx's `footer` / BoardPanel.tsx) — Button.tsx's
          // own `shrink-0` (#80) only governs its main-axis behaviour inside
          // THAT row, never this container's cross-axis stretch, so no
          // Button call site outside a SidePanel footer is affected. See
          // design/notes/SidePanel.md.
          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-surface p-4 md:border-t-0 md:bg-transparent">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
