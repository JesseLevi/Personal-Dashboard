import { describe, expect, it } from "vitest";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { boardCardActivationConstraints } from "../components/organisms/BoardView";

// #115/#116: real device/touch-emulation verification wasn't possible in
// this environment (see design/notes/BoardView.md) — this covers the branch
// logic itself, since dnd-kit calls `boardCardActivationConstraints` fresh
// per pointerdown with the real event rather than us reading a device-wide
// `matchMedia` once at mount (the bug this replaced).
function fakeEvent(pointerType: string): PointerEvent {
  return { pointerType } as PointerEvent;
}

// `options` is a protected member of dnd-kit's own `ActivationConstraint`
// class (TS-only — nothing stops reading it at runtime); this cast is only
// so the test can assert the actual value/tolerance it was built with.
function optionsOf(constraint: object): { value: number; tolerance?: number } {
  return (constraint as { options: { value: number; tolerance?: number } }).options;
}

describe("boardCardActivationConstraints", () => {
  it("gives touch a 750ms hold (#118, deviates from Figma node 3680:1442's 2s) with a jitter tolerance", () => {
    const constraints = boardCardActivationConstraints(fakeEvent("touch"));
    expect(constraints).toHaveLength(1);
    expect(constraints![0]).toBeInstanceOf(PointerActivationConstraints.Delay);
    expect(optionsOf(constraints![0])).toEqual({ value: 750, tolerance: 16 });
  });

  it("#116: touch tolerance is always a number, never undefined", () => {
    // Trap this ticket documents: DelayConstraint calls
    // exceedsDistance(delta, tolerance) unguarded (unlike DistanceConstraint,
    // which guards with `tolerance &&`), so an undefined tolerance throws a
    // TypeError on the first pointermove instead of silently no-op'ing.
    const [constraint] = boardCardActivationConstraints(fakeEvent("touch"))!;
    expect(typeof optionsOf(constraint).tolerance).toBe("number");
  });

  it("gives mouse the #94 quick delay+distance click-through constraint", () => {
    const constraints = boardCardActivationConstraints(fakeEvent("mouse"));
    expect(constraints).toHaveLength(2);
    expect(constraints![0]).toBeInstanceOf(PointerActivationConstraints.Delay);
    expect(optionsOf(constraints![0])).toEqual({ value: 200, tolerance: 10 });
    expect(constraints![1]).toBeInstanceOf(PointerActivationConstraints.Distance);
    expect(optionsOf(constraints![1])).toEqual({ value: 5 });
  });

  it("treats pen like mouse, not like touch — matches dnd-kit's own default grouping", () => {
    const constraints = boardCardActivationConstraints(fakeEvent("pen"));
    expect(constraints).toHaveLength(2);
  });

  it("picks the branch per-interaction, so a hybrid device isn't stuck on one guess", () => {
    // Same call, two different pointerTypes — proves this isn't a value
    // baked in once (the mount-time matchMedia bug #115 replaced).
    const touch = boardCardActivationConstraints(fakeEvent("touch"));
    const mouse = boardCardActivationConstraints(fakeEvent("mouse"));
    expect(touch).toHaveLength(1);
    expect(mouse).toHaveLength(2);
  });
});
