import { describe, expect, it } from "vitest";
import {
  InvalidNeighborOrderError,
  nextPosition,
} from "../lib/boards/positioning";

describe("nextPosition", () => {
  it("returns a default position for an empty list", () => {
    expect(nextPosition(null, null)).toBe(1000);
  });

  it("appends after the last item when there is no upper neighbor", () => {
    expect(nextPosition(1000, null)).toBe(2000);
    expect(nextPosition(2500, null)).toBe(3500);
  });

  it("inserts before the first item when there is no lower neighbor", () => {
    expect(nextPosition(null, 1000)).toBe(500);
    expect(nextPosition(null, 3)).toBe(1.5);
  });

  it("bisects the midpoint between two neighbors", () => {
    expect(nextPosition(1000, 2000)).toBe(1500);
    expect(nextPosition(1000, 1002)).toBe(1001);
  });

  it("keeps bisecting without ever reaching either neighbor", () => {
    const low = 1000;
    let high = 1001;
    for (let i = 0; i < 20; i++) {
      const mid = nextPosition(low, high);
      expect(mid).toBeGreaterThan(low);
      expect(mid).toBeLessThan(high);
      high = mid;
    }
  });

  it("throws when neighbors are out of order (stale/inconsistent input)", () => {
    expect(() => nextPosition(2000, 1000)).toThrow(InvalidNeighborOrderError);
  });

  it("throws when neighbors are equal", () => {
    expect(() => nextPosition(1000, 1000)).toThrow(InvalidNeighborOrderError);
  });
});
