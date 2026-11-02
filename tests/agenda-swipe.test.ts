import { describe, expect, it } from "vitest";
import {
  SWIPE_EDGE_PX,
  SWIPE_FLICK_MIN_PX,
  SWIPE_FLICK_VELOCITY_PX_MS,
  SWIPE_MAX_MS,
  swipeAxis,
  swipeMayStart,
  swipeOffset,
  swipeSettle,
  swipeStep,
  swipeVelocity,
  type SwipePoint,
} from "@/lib/agenda/swipe";

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

describe("swipeMayStart", () => {
  it("rejects the outer edges", () => {
    expect(swipeMayStart(SWIPE_EDGE_PX - 1, WIDTH)).toBe(false);
    expect(swipeMayStart(WIDTH - SWIPE_EDGE_PX + 1, WIDTH)).toBe(false);
    expect(swipeMayStart(WIDTH / 2, WIDTH)).toBe(true);
  });
});

describe("swipeAxis", () => {
  it("stays open inside the slop", () => {
    expect(swipeAxis(6, -4)).toBeNull();
  });

  it("locks to x when the stroke is wider than tall", () => {
    expect(swipeAxis(-14, 6)).toBe("x");
  });

  it("locks to y when the stroke is taller than wide", () => {
    expect(swipeAxis(6, 14)).toBe("y");
  });
});

describe("swipeOffset", () => {
  it("follows the finger one-to-one", () => {
    expect(swipeOffset(-120, WIDTH)).toBe(-120);
  });

  it("never passes the neighbour", () => {
    expect(swipeOffset(-900, WIDTH)).toBe(-WIDTH);
    expect(swipeOffset(900, WIDTH)).toBe(WIDTH);
  });
});

describe("swipeVelocity", () => {
  it("is the distance over the time inside the window", () => {
    const samples = [
      { x: 300, time: 0 },
      { x: 280, time: 50 },
      { x: 240, time: 100 },
    ];
    expect(swipeVelocity(samples, 100)).toBeCloseTo(-0.6);
  });

  it("ignores samples older than the window", () => {
    const samples = [
      { x: 300, time: 0 },
      { x: 100, time: 10 },
      { x: 98, time: 200 },
      { x: 97, time: 250 },
    ];
    expect(swipeVelocity(samples, 250)).toBeCloseTo(-0.02);
  });

  it("reads a finger that paused before lifting as still", () => {
    const samples = [
      { x: 300, time: 0 },
      { x: 100, time: 50 },
    ];
    expect(swipeVelocity(samples, 400)).toBe(0);
  });

  it("is 0 without two samples", () => {
    expect(swipeVelocity([], 10)).toBe(0);
    expect(swipeVelocity([{ x: 1, time: 5 }], 10)).toBe(0);
  });
});

describe("swipeSettle", () => {
  it("commits a slow drag past a third of the width", () => {
    expect(swipeSettle(-(WIDTH / 3) - 1, -0.1, WIDTH)).toBe(1);
    expect(swipeSettle(WIDTH / 3 + 1, 0.1, WIDTH)).toBe(-1);
  });

  it("returns a drag that stops short of a third", () => {
    expect(swipeSettle(-100, -0.1, WIDTH)).toBe(0);
    expect(swipeSettle(-(WIDTH / 3) + 1, 0, WIDTH)).toBe(0);
  });

  it("commits a short but fast flick", () => {
    expect(swipeSettle(-40, -SWIPE_FLICK_VELOCITY_PX_MS, WIDTH)).toBe(1);
    expect(swipeSettle(40, 1.2, WIDTH)).toBe(-1);
  });

  it("returns a flick that is too short to be one", () => {
    expect(swipeSettle(-(SWIPE_FLICK_MIN_PX - 1), -2, WIDTH)).toBe(0);
  });

  it("returns a flick slower than the threshold", () => {
    expect(swipeSettle(-40, -(SWIPE_FLICK_VELOCITY_PX_MS - 0.01), WIDTH)).toBe(0);
  });

  it("returns when the finger flicks back even past a third", () => {
    expect(swipeSettle(-200, 0.8, WIDTH)).toBe(0);
  });
});
