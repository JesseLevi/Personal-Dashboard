"use client";

// figma: node-id=3779:4846
import { cn } from "@/lib/ui/cn";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSheetDrag } from "@/lib/dom/use-sheet-drag";
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

  // Mobile-only (<md) drag-to-close from the handle strip; desktop keeps X/Escape/overlay-click only.
  const drag = useSheetDrag({
    getPanel: () => panelRef.current,
    canStart: () => open && !window.matchMedia("(min-width: 768px)").matches,
    onClose,
  });

  // A drag can be interrupted without pointerup/pointercancel (e.g. Escape mid-drag), leaving an inline
  // `transform` that composes with the class-driven `translate`. Reset on every open/close.
  useLayoutEffect(() => {
    drag.reset();
  }, [open, drag]);

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
      <div
        aria-hidden="true"
        onClick={onClose}
        // invisible + transition-discrete (#113, #222): design/notes/SidePanel.md.
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
          "fixed flex flex-col overflow-hidden bg-surface-primary transition-[transform,translate,visibility] transition-discrete duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
          level === 2 ? "z-[70]" : "z-50",
          // Corner radii 16/12 (Figma), spacing-flag: `rounded-tl-2xl` (#205), design/notes/SidePanel.md.
          "inset-x-0 bottom-0 max-h-[90vh] rounded-tl-2xl rounded-tr-control-outer",
          // `md:pt-` (#172): only the `md:` shape reaches the physical top
          // of the viewport (`md:inset-y-0`) — the mobile bottom sheet
          // never does, so it's exempt. No `max()` needed (unlike Sidebar's
          // idiom): there's no base padding to protect, `env()` resolves to
          // 0 with no inset, and the close button already has its own
          // click target inside the h-14 handle strip below.
          "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:max-h-none md:w-[400px] md:rounded-tr-none md:rounded-bl-control-outer md:pt-[env(safe-area-inset-top)]",
          // Bounce + overshoot-gap shadow below `md`: design/notes/SidePanel.md.
          open
            ? "visible translate-x-0 translate-y-0 max-md:animate-sheet-in max-md:transition-[transform]"
            : "invisible translate-y-full md:translate-x-full md:translate-y-0",
          footer
            ? "max-md:shadow-[0_var(--sheet-bounce)_0_0_var(--color-surface-highlight-white)]"
            : "max-md:shadow-[0_var(--sheet-bounce)_0_0_var(--color-surface-primary)]",
          className,
        )}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <div
          className="relative flex h-14 shrink-0 touch-none items-center justify-end px-component-lg md:touch-auto"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
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
