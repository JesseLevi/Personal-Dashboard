"use client";

// Client half of the shared popover positioner (lib/dom/popover-position.ts
// has the pure math). Every hand-rolled `absolute top-full …` popover in
// this codebase (PasAanPanel, WinkelmandList, NutritionalDataRow,
// RecipeDetailPage, TeDoenHeader ×2, NotitiesBoard, Sidebar) used a fixed
// Tailwind offset that silently broke the moment its trigger moved or the
// viewport got narrow — see docs/incidents.md (2026-08-18). This hook
// measures the real trigger/popover/bounds rects and turns them into an
// inline `left`/`top` via `computePopoverPlacement`.
//
// Deliberately stays `position: absolute` inside the existing `relative`
// wrapper rather than `fixed` or a portal — both were considered and
// rejected (SidePanel's panel root sets a non-`none` `translate` when open,
// which makes it the containing block for `fixed` descendants *and* still
// clips them via its own `overflow-hidden`, so `fixed` buys nothing there;
// portalling would pull the popover's buttons out of SidePanel's focus trap
// and its outside-pointerdown containment checks). See
// design/notes/SidePanel.md.

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  computePopoverPlacement,
  type PopoverAnchor,
  type PopoverDirection,
  type PopoverRect,
} from "./popover-position";

/**
 * A plain anchor applies at every breakpoint. `{ base, md }` switches at
 * `md` (768px) — read via `matchMedia` inside the measure effect, not at
 * render, same "never JS breakpoint detection for markup" precedent
 * SidePanel.tsx's own header comment states (there for a drag gesture, here
 * for a geometry offset — neither renders different markup per breakpoint).
 */
export type PopoverAnchorInput = PopoverAnchor | { base: PopoverAnchor; md: PopoverAnchor };

const MD_QUERY = "(min-width: 768px)";

function resolveAnchor(anchor: PopoverAnchorInput): PopoverAnchor {
  if (typeof anchor === "string") return anchor;
  return window.matchMedia(MD_QUERY).matches ? anchor.md : anchor.base;
}

export interface UsePopoverPositionOptions {
  open: boolean;
  anchor: PopoverAnchorInput;
  prefer: PopoverDirection;
  /** px between trigger and popover — today's `mt-2`/`mb-2` is 8. */
  gap?: number;
  /** min px kept between the popover and the clipping boundary's edges. */
  gutter?: number;
}

export interface PopoverPositionResult {
  /** Spread onto the popover's own element. `visibility: hidden` until the first measurement lands, so there's no flash at the wrong spot. */
  style: { position: "absolute"; left: number; top: number; visibility?: "hidden" };
  direction: PopoverDirection;
}

const DEFAULT_GAP = 8;
const DEFAULT_GUTTER = 8;

function toRect(el: Element): PopoverRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/** Nearest ancestor that actually clips (`overflow` isn't `visible` on either axis), falling back to the viewport — intersected with the viewport either way, so a scroll container taller than the screen still clamps sensibly. */
function findBounds(from: Element): PopoverRect {
  let node: Element | null = from.parentElement;
  let boundsRect: PopoverRect | null = null;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      boundsRect = toRect(node);
      break;
    }
    node = node.parentElement;
  }
  const viewport: PopoverRect = {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  if (!boundsRect) return viewport;
  const left = Math.max(boundsRect.left, viewport.left);
  const top = Math.max(boundsRect.top, viewport.top);
  const right = Math.min(boundsRect.right, viewport.right);
  const bottom = Math.min(boundsRect.bottom, viewport.bottom);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

interface Placement {
  left: number;
  top: number;
  direction: PopoverDirection;
}

function samePlacement(a: Placement | null, b: Placement): boolean {
  return a !== null && a.left === b.left && a.top === b.top && a.direction === b.direction;
}

/**
 * Positions a popover against its trigger wrapper, clamped into the nearest
 * clipping ancestor. `wrapperRef` is the existing `relative` div — its
 * border box already equals the trigger's own box at every call site,
 * because an absolutely positioned child contributes nothing to it.
 *
 * Re-measures on every render while `open` (not just on the false->true
 * transition): NutritionalDataRow shares one ref pair across six triggers
 * (only one popover is ever open), so the DOM node a ref points at can
 * change without `open` itself toggling — an effect gated on `[open]` alone
 * would miss that. Bails out of the state update when nothing moved, so
 * this can't loop.
 */
export function usePopoverPosition(
  wrapperRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  { open, anchor, prefer, gap = DEFAULT_GAP, gutter = DEFAULT_GUTTER }: UsePopoverPositionOptions,
): PopoverPositionResult {
  const [placement, setPlacement] = useState<Placement | null>(null);

  function measure() {
    const wrapperEl = wrapperRef.current;
    const popoverEl = popoverRef.current;
    if (!wrapperEl || !popoverEl) return;
    const triggerRect = toRect(wrapperEl);
    const popoverRect = popoverEl.getBoundingClientRect();
    const bounds = findBounds(wrapperEl);
    const result = computePopoverPlacement({
      trigger: triggerRect,
      popover: { width: popoverRect.width, height: popoverRect.height },
      bounds,
      anchor: resolveAnchor(anchor),
      prefer,
      gap,
      gutter,
    });
    // Convert viewport coords -> offsets relative to the wrapper, since the
    // popover stays `position: absolute` inside it.
    const next: Placement = {
      left: result.left - triggerRect.left,
      top: result.top - triggerRect.top,
      direction: result.direction,
    };
    setPlacement((prev) => (samePlacement(prev, next) ? prev : next));
  }

  // Runs after every commit while open, not just on mount — see the header
  // comment on `samePlacement`'s bail-out for why that's required, and why
  // it's still safe: `setPlacement` only actually updates state (and so
  // re-triggers this effect) when the computed position changed, so this
  // can't loop. Deliberately no dependency array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!open) {
      setPlacement((prev) => (prev === null ? prev : null));
      return;
    }
    measure();
  });

  // Kept fresh every render so the listener below never closes over a stale
  // anchor/prefer/gap/gutter — the listener effect itself only re-subscribes
  // on `open`, not on every prop change.
  const measureRef = useRef(measure);
  measureRef.current = measure;

  useLayoutEffect(() => {
    if (!open) return;
    function onWindowChange() {
      measureRef.current();
    }
    window.addEventListener("resize", onWindowChange);
    // Capture phase: the headers this hook covers are `sticky` and several
    // pages scroll, so any scrolling ancestor can change the clamp decision.
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [open]);

  if (!placement) {
    return { style: { position: "absolute", left: 0, top: 0, visibility: "hidden" }, direction: prefer };
  }
  return {
    style: { position: "absolute", left: placement.left, top: placement.top },
    direction: placement.direction,
  };
}
