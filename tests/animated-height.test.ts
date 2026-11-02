import { describe, expect, it } from "vitest";
import { planHeightTransition } from "../lib/dom/use-animated-height";

describe("planHeightTransition", () => {
  it("does not animate the first sizing", () => {
    expect(planHeightTransition({ previous: null, next: 400, inFlight: null })).toBeNull();
  });

  it("animates from the previous content height to the new one", () => {
    expect(planHeightTransition({ previous: 400, next: 520, inFlight: null })).toEqual({ from: 400, to: 520 });
    expect(planHeightTransition({ previous: 520, next: 380, inFlight: null })).toEqual({ from: 520, to: 380 });
  });

  it("restarts from the rendered height when an earlier transition is still running", () => {
    expect(planHeightTransition({ previous: 520, next: 380, inFlight: 455 })).toEqual({ from: 455, to: 380 });
  });

  it("ignores sub-pixel noise", () => {
    expect(planHeightTransition({ previous: 400, next: 400.3, inFlight: null })).toBeNull();
  });
});
