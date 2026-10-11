import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX_LENGTH, updateDisplayNameSchema } from "../lib/profile/schemas";

describe("updateDisplayNameSchema", () => {
  it("trims the name", () => {
    expect(updateDisplayNameSchema.parse({ displayName: "  Jesse  " })).toEqual({
      displayName: "Jesse",
    });
  });

  it("turns empty and whitespace-only input into null", () => {
    expect(updateDisplayNameSchema.parse({ displayName: "" }).displayName).toBeNull();
    expect(updateDisplayNameSchema.parse({ displayName: "   " }).displayName).toBeNull();
  });

  it("accepts exactly the max length and rejects one more", () => {
    const ok = "a".repeat(DISPLAY_NAME_MAX_LENGTH);
    expect(updateDisplayNameSchema.safeParse({ displayName: ok }).success).toBe(true);
    expect(updateDisplayNameSchema.safeParse({ displayName: ok + "a" }).success).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(updateDisplayNameSchema.safeParse({ displayName: 5 }).success).toBe(false);
    expect(updateDisplayNameSchema.safeParse({}).success).toBe(false);
  });
});
