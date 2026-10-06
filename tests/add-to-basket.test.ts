import { describe, expect, it } from "vitest";
import { playsAddedFace } from "@/lib/ui/add-to-basket";

describe("playsAddedFace", () => {
  it("plays the success face when the action succeeds", async () => {
    expect(await playsAddedFace(async () => ({ success: true, data: undefined }))).toBe(true);
  });

  it("does not play the success face when the action fails", async () => {
    expect(await playsAddedFace(async () => ({ success: false, error: "generic" }))).toBe(false);
  });

  it("does not play the success face when the action throws", async () => {
    expect(
      await playsAddedFace(async () => {
        throw new Error("network");
      }),
    ).toBe(false);
  });
});
