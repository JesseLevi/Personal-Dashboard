"use client";

// figma: node-id=3779:4846
import { cn } from "@/lib/ui/cn";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Button } from "../atoms/Button";

/**
 * Organism/SidePanel — Figma "Te doen/Mobile/AddItem" (3779:4846) + its
 * desktop pair (3779:4938, broken layer name "y"). Same panel, two shapes
 * via `md:` only — never JS breakpoint detection for the *markup*. Empty
 * shell: `children` (fields) + `footer` (actions) are composer-supplied,
 * per #89. `title` is required so `aria-labelledby` always resolves. #103's
 * mobile-only drag-to-close *gesture* is the one deliberate runtime-only
 * exception (`matchMedia` at drag-start, not render) — Figma models no
 * gesture. `level` (#149) stacks a second panel (scrim + panel) above a
 * level-1 one already on screen. Full rationale + measurements:
 * design/notes/SidePanel.md.
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
  /**
   * Stacking level (#149). `1` (default): today's `z-40` scrim / `z-50`
   * panel, unchanged. `2`: renders above a level-1 panel INCLUDING its
   * scrim, so opening a second panel (e.g. `StepIngredientPanel` over
   * `RecipePanel`) visibly dims the first one too, matching Figma's
   * full-screen overlay on the second pull-up panel. See
   * design/notes/SidePanel.md.
   */
  level?: 1 | 2;
}

export function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  className,
  level = 1,
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

  // A drag can be interrupted without pointerup/pointercancel ever firing
  // (e.g. Escape mid-drag) — endDrag() then never runs, leaving an inline
  // `transform` that composes with the class-driven `translate` utility
  // (a separate CSS property in Tailwind v4) instead of being replaced by
  // it, offsetting the panel from its resting position. Reset on every
  // open/close so no route can leave that residue.
  useLayoutEffect(() => {
    dragRef.current = null;
    panelRef.current?.style.removeProperty("transform");
    panelRef.current?.style.removeProperty("transition-duration");
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
      {/* #222: was `bg-text-primary/60` — matched Figma in light mode but
          inverted to a light scrim in dark mode (text-primary flips to
          stone-50 there). Now `overlay`, a codebase-only token pinned to
          stone-950 in both modes; see design/notes/SidePanel.md. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        // `invisible`/`transition-discrete` (#113): opacity alone left the
        // scrim mounted and composited at `opacity-0` — on iOS Safari this
        // is the prime suspect for a stale-tinted status-bar strip after
        // close (unverified on-device, see design/notes/SidePanel.md).
        // `transition-discrete` (Tailwind's `transition-behavior:
        // allow-discrete`) defers the `visibility` flip to hidden until the
        // opacity transition finishes, so the fade-out still plays.
        className={cn(
          "fixed inset-0 bg-overlay/60 transition-[opacity,visibility] transition-discrete duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          level === 2 ? "z-[60]" : "z-40",
          open ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
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
        className={cn(
          "fixed flex flex-col overflow-hidden bg-surface-primary transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          level === 2 ? "z-[70]" : "z-50",
          // Corner radii are 16/12, not a uniform value on either shape —
          // Figma reports "16px 12px 0px 0px" (mobile) / "16px 0px 0px 12px"
          // (desktop). #205: `rounded-tl-2xl`/(desktop) stays raw — the
          // fetched node's own `topLeftRadius` binds a SPACING variable
          // (`spacing/component/padding-lg`), not a radius one, and 16px
          // has no step in `radius`'s scale (4/6/8/12/24) either way; a
          // genuine Figma authoring artifact, not a missed lookup. `-xl`
          // corners (12px) → `radius/control-outer`, confirmed on the
          // fetched node. spacing-flag: `rounded-tl-2xl`. See design/notes/SidePanel.md.
          "inset-x-0 bottom-0 max-h-[90vh] rounded-tl-2xl rounded-tr-control-outer",
          // `md:pt-` (#172): only the `md:` shape reaches the physical top
          // of the viewport (`md:inset-y-0`) — the mobile bottom sheet
          // never does, so it's exempt. No `max()` needed (unlike Sidebar's
          // idiom): there's no base padding to protect, `env()` resolves to
          // 0 with no inset, and the close button already has its own
          // click target inside the h-14 handle strip below.
          "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:max-h-none md:w-[400px] md:rounded-tr-none md:rounded-bl-control-outer md:pt-[env(safe-area-inset-top)]",
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
          className="relative flex h-14 shrink-0 touch-none items-center justify-end px-component-lg md:touch-auto"
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
            className="absolute top-3 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-stroke-primary md:hidden"
          />
          <Button variant="filled" icon="X" aria-label={closeLabel} onClick={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-stack-xl overflow-y-auto px-component-lg pb-component-lg">
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
          <div
            // `pb-[max(...)]` (#113, mobile only): the home-indicator safe
            // area can exceed the stated 16px padding on notched devices —
            // `max()` only ever adds space, never shrinks the existing
            // padding on devices with no inset. Unverified on a real device;
            // see design/notes/SidePanel.md.
            className="flex shrink-0 flex-col gap-inline-sm border-t border-stroke-primary bg-surface-highlight-white p-component-lg pb-[max(1rem,env(safe-area-inset-bottom))] md:border-t-0 md:bg-transparent md:pb-component-lg"
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
