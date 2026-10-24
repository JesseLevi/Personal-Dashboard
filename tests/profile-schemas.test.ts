import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX_LENGTH, setAiEnabledSchema, updateNameSchema } from "../lib/profile/schemas";

describe("updateNameSchema", () => {
  it("trims both names", () => {
    expect(updateNameSchema.parse({ firstName: "  Jesse  ", lastName: " Kamps " })).toEqual({
      firstName: "Jesse",
      lastName: "Kamps",
    });
  });

  it("turns empty and whitespace-only input into null", () => {
    expect(updateNameSchema.parse({ firstName: "", lastName: "   " })).toEqual({
      firstName: null,
      lastName: null,
    });
  });

  it("accepts exactly the max length and rejects one more, per field", () => {
    const ok = "a".repeat(DISPLAY_NAME_MAX_LENGTH);
    expect(updateNameSchema.safeParse({ firstName: ok, lastName: ok }).success).toBe(true);
    expect(updateNameSchema.safeParse({ firstName: ok + "a", lastName: "" }).success).toBe(false);
    expect(updateNameSchema.safeParse({ firstName: "", lastName: ok + "a" }).success).toBe(false);
  });

  it("rejects non-string or missing input", () => {
    expect(updateNameSchema.safeParse({ firstName: 5, lastName: "" }).success).toBe(false);
    expect(updateNameSchema.safeParse({ firstName: "" }).success).toBe(false);
    expect(updateNameSchema.safeParse({}).success).toBe(false);
  });
});

describe("setAiEnabledSchema", () => {
  it("accepts a boolean and rejects everything else", () => {
    expect(setAiEnabledSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(setAiEnabledSchema.safeParse({ enabled: "true" }).success).toBe(false);
    expect(setAiEnabledSchema.safeParse({}).success).toBe(false);
  });
});
