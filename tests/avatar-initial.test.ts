import { describe, expect, it } from "vitest";
import { initialFor } from "@/components/atoms/Avatar";

describe("initialFor", () => {
  it("returns the uppercase first letter of the first name", () => {
    expect(initialFor("jesse Kamps")).toBe("J");
    expect(initialFor("  Anne de Vries")).toBe("A");
  });
  it("returns an empty string for an empty name", () => {
    expect(initialFor("   ")).toBe("");
  });
});
