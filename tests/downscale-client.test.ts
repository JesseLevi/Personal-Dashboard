import { describe, expect, it } from "vitest";
import { targetDimensions } from "@/lib/images/downscale-client";

// #174/#171 chunk 3: only `targetDimensions` is unit-testable under
// Vitest/jsdom -- the canvas/createImageBitmap encode path in
// downscale-client.ts is not (no real OffscreenCanvas/WebP encoder in
// jsdom), and per the ticket brief it stays thin rather than being faked
// with elaborate mocks. This pure helper carries the actual sizing logic.

describe("targetDimensions", () => {
  it("downscales a landscape image, preserving aspect ratio", () => {
    expect(targetDimensions(3000, 2000, 1600)).toEqual({ width: 1600, height: 1067 });
  });

  it("downscales a portrait image, preserving aspect ratio", () => {
    expect(targetDimensions(2000, 3000, 1600)).toEqual({ width: 1067, height: 1600 });
  });

  it("downscales a square image", () => {
    expect(targetDimensions(2400, 2400, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("never enlarges an image already smaller than maxEdge", () => {
    expect(targetDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("is a no-op exactly at the boundary", () => {
    expect(targetDimensions(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("returns integers even for a source that would scale to a fraction", () => {
    const result = targetDimensions(2999, 1000, 1600);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
    expect(result).toEqual({ width: 1600, height: 534 });
  });

  it("never rounds an edge down to 0 for an extreme aspect ratio", () => {
    const result = targetDimensions(10000, 1, 1600);
    expect(result.width).toBe(1600);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
