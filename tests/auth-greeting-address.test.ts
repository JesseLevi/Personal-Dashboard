import { describe, expect, it } from "vitest";
import { GREETING_LOOKUP_DEBOUNCE_MS, parseGreetingAddress } from "../lib/auth/greeting-address";

describe("parseGreetingAddress (#416)", () => {
  it("returns the same address for padded and unpadded input", () => {
    expect(parseGreetingAddress("a@b.com")).toBe("a@b.com");
    expect(parseGreetingAddress("  a@b.com ")).toBe("a@b.com");
  });

  it("returns null for empty, partial and non-string input", () => {
    expect(parseGreetingAddress("")).toBeNull();
    expect(parseGreetingAddress("   ")).toBeNull();
    expect(parseGreetingAddress("a@gmail")).toBeNull();
    expect(parseGreetingAddress("a@b")).toBeNull();
    expect(parseGreetingAddress(null)).toBeNull();
  });

  it("debounces for 250ms", () => {
    expect(GREETING_LOOKUP_DEBOUNCE_MS).toBe(250);
  });
});
