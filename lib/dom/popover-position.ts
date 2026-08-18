// Pure geometry for the hand-rolled `absolute top-full …` popover pattern
// used by PasAanPanel/WinkelmandList/NutritionalDataRow/RecipeDetailPage/
// TeDoenHeader/NotitiesBoard/Sidebar. Extracted so the placement math can be
// unit tested without jsdom/RTL — see tests/popover-position.test.ts — same
// reasoning as lib/dom/outside-pointer.ts. No DOM, no window access:
// everything the caller knows (trigger/popover/bounds rects) comes in as
// plain data, a placement comes back out. `lib/dom/use-popover-position.ts`
// is the only caller that touches the DOM.

/** A viewport-coordinate rect — the shape `getBoundingClientRect()` returns. */
export interface PopoverRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Only the size matters for the popover itself — its position is what we're computing. */
export interface PopoverSize {
  width: number;
  height: number;
}

/** The designed horizontal anchor — which edge of the trigger the popover starts flush with. */
export type PopoverAnchor = "left" | "right" | "center";

/** The designed vertical direction — which side of the trigger the popover opens toward. */
export type PopoverDirection = "below" | "above";

export interface ComputePopoverPlacementInput {
  /** The trigger element's rect, in viewport coordinates. */
  trigger: PopoverRect;
  /** The popover's own (measured) size. */
  popover: PopoverSize;
  /** The clipping boundary's rect, in viewport coordinates (already intersected with the viewport by the caller). */
  bounds: PopoverRect;
  anchor: PopoverAnchor;
  prefer: PopoverDirection;
  /** px kept between the trigger and the popover along the vertical axis. */
  gap: number;
  /** min px kept between the popover and the bounds edges. */
  gutter: number;
}

export interface PopoverPlacement {
  /** Viewport-coordinate left/top for the popover's top-left corner. */
  left: number;
  top: number;
  /** Which side the popover actually landed on, after any flip. */
  direction: PopoverDirection;
}

function clamp(value: number, min: number, max: number): number {
  // A bounds box narrower than the popover plus both gutters would make
  // `max < min` — pin to `min` (the left/top gutter) rather than let
  // `Math.min(Math.max(...))` return a value past `max` or produce NaN from
  // an inverted range.
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function designedLeft(trigger: PopoverRect, popover: PopoverSize, anchor: PopoverAnchor): number {
  switch (anchor) {
    case "left":
      return trigger.left;
    case "right":
      return trigger.right - popover.width;
    case "center":
      return trigger.left + trigger.width / 2 - popover.width / 2;
  }
}

function fitsVertically(top: number, popoverHeight: number, bounds: PopoverRect): boolean {
  return top >= bounds.top && top + popoverHeight <= bounds.bottom;
}

/**
 * Computes where a popover should render given its designed anchor/direction,
 * clamping horizontally into `bounds` and flipping vertically only when the
 * designed side doesn't fit and the other one does. Pure and rect-based —
 * see the header comment for why.
 */
export function computePopoverPlacement({
  trigger,
  popover,
  bounds,
  anchor,
  prefer,
  gap,
  gutter,
}: ComputePopoverPlacementInput): PopoverPlacement {
  const minLeft = bounds.left + gutter;
  const maxLeft = bounds.right - gutter - popover.width;
  const left = clamp(designedLeft(trigger, popover, anchor), minLeft, maxLeft);

  const belowTop = trigger.bottom + gap;
  const aboveTop = trigger.top - gap - popover.height;
  const preferredTop = prefer === "below" ? belowTop : aboveTop;
  const otherTop = prefer === "below" ? aboveTop : belowTop;
  const otherDirection: PopoverDirection = prefer === "below" ? "above" : "below";

  let top: number;
  let direction: PopoverDirection;
  if (fitsVertically(preferredTop, popover.height, bounds)) {
    top = preferredTop;
    direction = prefer;
  } else if (fitsVertically(otherTop, popover.height, bounds)) {
    top = otherTop;
    direction = otherDirection;
  } else {
    // Neither side fits — keep the designed side rather than flip into a
    // position that's guaranteed no better.
    top = preferredTop;
    direction = prefer;
  }

  return { left, top, direction };
}
