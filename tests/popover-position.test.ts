import { describe, expect, it } from "vitest";
import { computePopoverPlacement, type PopoverRect } from "../lib/dom/popover-position";

// Plain rects, no DOM — this project's test infra is Vitest's node
// environment (tests/**/*.test.ts), same style as outside-pointer.test.ts.
function rect(left: number, top: number, width: number, height: number): PopoverRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

const VIEWPORT = rect(0, 0, 400, 800);
const GAP = 8;
const GUTTER = 8;

describe("computePopoverPlacement", () => {
  it("fits as designed: right-anchored below, no shift", () => {
    // Trigger near the left edge, plenty of room below and to the right.
    const trigger = rect(20, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 100, height: 80 },
      bounds: VIEWPORT,
      anchor: "right",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // right-anchored: left = trigger.right - popover.width = 60 - 100 = -40, clamped to gutter (8)
    // trigger.right (60) is inside bounds, so with room the panel would rather sit flush;
    // here it's clamped because it would run off the left edge.
    expect(result).toEqual({ left: 8, top: 148, direction: "below" });
  });

  it("fits as designed: left-anchored below, room on every side, no shift", () => {
    const trigger = rect(150, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 100, height: 80 },
      bounds: VIEWPORT,
      anchor: "left",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    expect(result).toEqual({ left: 150, top: 148, direction: "below" });
  });

  it("clamps a right-edge overflow (left anchor pushes the popover past bounds.right)", () => {
    // Trigger near the right edge; a left-anchored 100px-wide popover would overflow.
    const trigger = rect(350, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 100, height: 80 },
      bounds: VIEWPORT,
      anchor: "left",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // designed left = 350, max allowed = 400 - 8 - 100 = 292
    expect(result.left).toBe(292);
    expect(result.top).toBe(148);
  });

  it("clamps a left-edge overflow (right anchor pulls the popover past bounds.left)", () => {
    // Winkelmand-shaped regression: a short trigger near the left edge, right-anchored
    // popover wider than the trigger overflows past bounds.left.
    const trigger = rect(20, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 209, height: 80 },
      bounds: VIEWPORT,
      anchor: "right",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // designed left = 60 - 209 = -149, min allowed = 8
    expect(result.left).toBe(8);
  });

  it("pins to the left gutter when the popover is wider than the available bounds", () => {
    const narrowBounds = rect(0, 0, 150, 800);
    const trigger = rect(20, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 209, height: 80 },
      bounds: narrowBounds,
      anchor: "left",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // max = 150 - 8 - 209 = -67 < min (8) -> pinned to min, never negative-width/NaN
    expect(result.left).toBe(8);
    expect(Number.isNaN(result.left)).toBe(false);
  });

  it("flips up when there is no room below but there is above (PasAanPanel-shaped)", () => {
    // Trigger near the bottom of a short bounds box (e.g. SidePanel's scroll area).
    const bounds = rect(0, 0, 400, 300);
    const trigger = rect(100, 260, 100, 30);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 160, height: 100 },
      bounds,
      anchor: "right",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // below: top = 298, +100 = 398 > bounds.bottom (300) -> doesn't fit
    // above: top = 260 - 8 - 100 = 152, >= bounds.top (0) and 152+100=252 <= 300 -> fits
    expect(result.direction).toBe("above");
    expect(result.top).toBe(152);
  });

  it("does not flip when neither side fits — keeps the designed side", () => {
    // A bounds box shorter than the popover on both sides of the trigger.
    const bounds = rect(0, 0, 400, 120);
    const trigger = rect(100, 40, 100, 30);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 160, height: 100 },
      bounds,
      anchor: "left",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // below: top = 78, +100 = 178 > 120 -> doesn't fit
    // above: top = 40 - 8 - 100 = -68, < bounds.top (0) -> doesn't fit either
    expect(result.direction).toBe("below");
    expect(result.top).toBe(78);
  });

  it("stays below when it already fits, even though prefer allows a flip check", () => {
    const trigger = rect(100, 100, 100, 30);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 160, height: 80 },
      bounds: VIEWPORT,
      anchor: "left",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    expect(result.direction).toBe("below");
    expect(result.top).toBe(138);
  });

  it("anchor=center starts the popover centred on the trigger, then clamps", () => {
    const trigger = rect(150, 100, 40, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 100, height: 80 },
      bounds: VIEWPORT,
      anchor: "center",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // trigger centre = 170, popover half-width = 50 -> left = 120
    expect(result.left).toBe(120);
  });

  it("anchor=center clamps when centring would overflow the right edge", () => {
    const trigger = rect(370, 100, 20, 40);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 100, height: 80 },
      bounds: VIEWPORT,
      anchor: "center",
      prefer: "below",
      gap: GAP,
      gutter: GUTTER,
    });
    // trigger centre = 380, designed left = 330, max = 400 - 8 - 100 = 292
    expect(result.left).toBe(292);
  });

  it("prefer=above flips down when there is no room above but there is below", () => {
    const bounds = rect(0, 0, 400, 300);
    const trigger = rect(100, 20, 100, 30);
    const result = computePopoverPlacement({
      trigger,
      popover: { width: 160, height: 100 },
      bounds,
      anchor: "left",
      prefer: "above",
      gap: GAP,
      gutter: GUTTER,
    });
    // above: top = 20 - 8 - 100 = -88 -> doesn't fit
    // below: top = 50 + 8 = 58, +100 = 158 <= 300 -> fits
    expect(result.direction).toBe("below");
    expect(result.top).toBe(58);
  });
});
