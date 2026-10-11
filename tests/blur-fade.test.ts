import { describe, expect, it } from "vitest";
import {
  BLUR_FADE,
  blurFadeStagger,
  blurInTotalMs,
  blurOutTotalMs,
} from "@/lib/ui/blur-fade";

describe("blurFadeStagger", () => {
  it("returns the literal class per index", () => {
    expect(blurFadeStagger(0)).toBe("[--fade-index:0]");
    expect(blurFadeStagger(5)).toBe("[--fade-index:5]");
  });
  it("clamps out-of-range and invalid input", () => {
    expect(blurFadeStagger(42)).toBe("[--fade-index:9]");
    expect(blurFadeStagger(-3)).toBe("[--fade-index:0]");
    expect(blurFadeStagger(Number.NaN)).toBe("[--fade-index:0]");
  });
});

describe("blurOutTotalMs / blurInTotalMs", () => {
  it("is the bare duration for 0 or 1 elements", () => {
    expect(blurOutTotalMs(0)).toBe(BLUR_FADE.outMs);
    expect(blurOutTotalMs(1)).toBe(BLUR_FADE.outMs);
  });
  it("adds the stagger of the last element", () => {
    expect(blurOutTotalMs(4)).toBe(150 + BLUR_FADE.outMs);
    expect(blurInTotalMs(4)).toBe(150 + BLUR_FADE.inMs);
  });
  it("caps the delay", () => {
    expect(blurOutTotalMs(50)).toBe(BLUR_FADE.maxDelayMs + BLUR_FADE.outMs);
  });
  it("drops stagger under reduced motion", () => {
    expect(blurOutTotalMs(8, true)).toBe(BLUR_FADE.reducedMs);
    expect(blurInTotalMs(8, true)).toBe(BLUR_FADE.reducedMs);
  });
});
