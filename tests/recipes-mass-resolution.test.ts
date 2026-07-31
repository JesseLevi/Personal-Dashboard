import { describe, expect, it } from "vitest";
import { resolveMass } from "../lib/recipes/mass-resolution";

// Unit tests for ADR-0011 §3's precedence order (user override -> reference
// -> unresolved). resolveMass lives in its own framework-free module
// (lib/recipes/mass-resolution.ts, no "server-only") specifically so it can
// be imported here without pulling in lib/recipes/queries.ts's Supabase/
// server-only dependencies — see that module's header comment.

describe("resolveMass", () => {
  it("resolves to the user override when both an override and a reference value exist", () => {
    expect(resolveMass(81, 90)).toEqual({ status: "resolved", grams: 81 });
  });

  it("falls back to the reference value when there is no user override", () => {
    expect(resolveMass(null, 58)).toEqual({ status: "resolved", grams: 58 });
  });

  it("is unresolved when neither a user override nor a reference value exists", () => {
    expect(resolveMass(null, null)).toEqual({ status: "unresolved" });
  });

  it("never coerces a zero-gram override into unresolved (0 is a valid resolved weight)", () => {
    // Not a realistic ingredient mass, but the point is structural: this
    // function must branch on `!== null`, not on truthiness, or a
    // legitimate (if odd) 0-gram override would be silently skipped in
    // favor of the reference value — exactly the "0 coerced into a known
    // weight" pitfall ADR-0011 §4 warns about for the nutrition columns.
    expect(resolveMass(0, 90)).toEqual({ status: "resolved", grams: 0 });
  });

  it("prefers a reference value of 0 over unresolved when there is no override", () => {
    expect(resolveMass(null, 0)).toEqual({ status: "resolved", grams: 0 });
  });
});
