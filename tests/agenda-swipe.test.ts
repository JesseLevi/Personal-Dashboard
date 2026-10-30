import { describe, expect, it } from "vitest";
import { SWIPE_MAX_MS, swipeStep, type SwipePoint } from "@/lib/agenda/swipe";

const WIDTH = 390;
const at = (x: number, y: number, time = 0): SwipePoint => ({ x, y, time });

describe("swipeStep", () => {
  it("moves to the next day when the finger goes left", () => {
    expect(swipeStep(at(300, 400), at(200, 410, 200), WIDTH)).toBe(1);
  });

  it("moves to the previous day when the finger goes right", () => {
    expect(swipeStep(at(100, 400), at(220, 390, 200), WIDTH)).toBe(-1);
  });

  it("ignores a short stroke", () => {
    expect(swipeStep(at(200, 400), at(170, 400, 100), WIDTH)).toBeNull();
  });

  it("ignores a mostly vertical stroke", () => {
    expect(swipeStep(at(200, 400), at(130, 250, 200), WIDTH)).toBeNull();
  });

  it("ignores a slow stroke, so a long-press drag never counts", () => {
    expect(swipeStep(at(300, 400), at(150, 400, SWIPE_MAX_MS + 1), WIDTH)).toBeNull();
  });

  it("leaves the screen edges to the browser's back and forward gesture", () => {
    expect(swipeStep(at(10, 400), at(200, 400, 200), WIDTH)).toBeNull();
    expect(swipeStep(at(WIDTH - 10, 400), at(200, 400, 200), WIDTH)).toBeNull();
  });
});
