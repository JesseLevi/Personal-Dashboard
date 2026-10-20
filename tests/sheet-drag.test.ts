import { describe, expect, it, vi } from "vitest";
import {
  DRAG_CLOSE_DISTANCE_PX,
  DRAG_SLOP_PX,
  createSheetDrag,
  type SheetDragEvent,
} from "../lib/dom/use-sheet-drag";

// Fake panel: the controller only touches `style` (transform, transition-duration, custom property).
function fakePanel() {
  const values = new Map<string, string>();
  return {
    values,
    style: {
      set transform(value: string) {
        values.set("transform", value);
      },
      get transform() {
        return values.get("transform") ?? "";
      },
      set transitionDuration(value: string) {
        values.set("transition-duration", value);
      },
      setProperty: (name: string, value: string) => void values.set(name, value),
      removeProperty: (name: string) => void values.delete(name),
    },
  };
}

function setup(canStart = true) {
  const panel = fakePanel();
  const onClose = vi.fn();
  const drag = createSheetDrag(() => ({
    getPanel: () => panel as unknown as HTMLElement,
    canStart: () => canStart,
    onClose,
  }));
  const capture = vi.fn();
  const preventDefault = vi.fn();
  const event = (clientY: number, timeStamp: number, target: EventTarget | null = null): SheetDragEvent => ({
    pointerId: 1,
    clientY,
    timeStamp,
    target,
    currentTarget: { setPointerCapture: capture },
    preventDefault,
  });
  return { panel, onClose, drag, capture, preventDefault, event };
}

describe("createSheetDrag", () => {
  it("ignores movement inside the slop", () => {
    const { drag, panel, capture, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(100 + DRAG_SLOP_PX - 1, 50));
    expect(capture).not.toHaveBeenCalled();
    expect(panel.values.has("transform")).toBe(false);
  });

  it("follows the finger past the slop, with pointer capture and no CSS transition", () => {
    const { drag, panel, capture, preventDefault, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(140, 100));
    expect(capture).toHaveBeenCalledWith(1);
    expect(panel.values.get("transition-duration")).toBe("0s");
    expect(panel.values.get("transform")).toBe("translateY(40px)");
    expect(preventDefault).toHaveBeenCalled();
  });

  it("closes past the distance threshold, leaving the offset for the exit keyframe", () => {
    const { drag, panel, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(100 + DRAG_CLOSE_DISTANCE_PX + 1, 2000));
    drag.onPointerUp(event(100 + DRAG_CLOSE_DISTANCE_PX + 1, 2001));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(panel.values.get("--sheet-drag-offset")).toBe(`${DRAG_CLOSE_DISTANCE_PX + 1}px`);
    expect(panel.values.has("transform")).toBe(false);
  });

  it("snaps back when released short of the distance and slower than the flick velocity", () => {
    const { drag, panel, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(180, 1000)); // 0.08 px/ms
    drag.onPointerUp(event(180, 1001));
    expect(onClose).not.toHaveBeenCalled();
    expect(panel.values.has("transform")).toBe(false);
    expect(panel.values.has("transition-duration")).toBe(false);
    expect(panel.values.has("--sheet-drag-offset")).toBe(false);
  });

  it("closes on a fast flick before the distance threshold", () => {
    const { drag, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(120, 10)); // 2 px/ms
    drag.onPointerMove(event(150, 30)); // 1.5 px/ms
    drag.onPointerUp(event(150, 31));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the last movement was slow, even after a fast start", () => {
    const { drag, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(130, 10));
    drag.onPointerMove(event(140, 500)); // 0.02 px/ms
    drag.onPointerUp(event(140, 501));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels on an upward drag", () => {
    const { drag, capture, panel, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(100 - DRAG_SLOP_PX - 2, 20));
    drag.onPointerMove(event(300, 40)); // a later downward move no longer counts
    drag.onPointerUp(event(300, 41));
    expect(capture).not.toHaveBeenCalled();
    expect(panel.values.has("transform")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("snaps back on pointercancel whatever the distance", () => {
    const { drag, panel, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(400, 10)); // far and fast
    drag.onPointerCancel(event(400, 11));
    expect(onClose).not.toHaveBeenCalled();
    expect(panel.values.has("transform")).toBe(false);
    expect(panel.values.has("transition-duration")).toBe(false);
    expect(panel.values.has("--sheet-drag-offset")).toBe(false);
  });

  it("never starts when canStart is false", () => {
    const { drag, capture, event } = setup(false);
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(200, 100));
    expect(capture).not.toHaveBeenCalled();
  });

  it("never starts on a button (the close button keeps its own click)", () => {
    const { drag, capture, event } = setup();
    const button = { closest: (selector: string) => (selector === "button" ? {} : null) } as unknown as EventTarget;
    drag.onPointerDown(event(100, 0, button));
    drag.onPointerMove(event(200, 100));
    expect(capture).not.toHaveBeenCalled();
  });

  it("ignores moves from another pointer", () => {
    const { drag, capture, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove({ ...event(200, 100), pointerId: 2 });
    expect(capture).not.toHaveBeenCalled();
  });

  it("reset drops a drag and clears the inline residue", () => {
    const { drag, panel, onClose, event } = setup();
    drag.onPointerDown(event(100, 0));
    drag.onPointerMove(event(160, 100));
    drag.reset();
    drag.onPointerUp(event(400, 101));
    expect(panel.values.has("transform")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
