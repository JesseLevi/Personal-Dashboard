import { describe, expect, it } from "vitest";
import {
  EMPTY_BRIDGE_UNIT_GRAMS,
  resolveMass,
  resolveMassWithBridge,
  type BridgeUnitGrams,
} from "../lib/recipes/mass-resolution";

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

// #164/#157: resolveMassWithBridge extends resolveMass with two more,
// lower-priority tiers (ml bridge, then spoon bridge -- see
// lib/recipes/mass-resolution.ts's header for the full five-tier order and
// the rationale for each). These tests build BridgeUnitGrams objects by
// hand rather than going through queries.ts, exactly the pure/framework-free
// promise this module makes.

function bridge(overrides: Partial<BridgeUnitGrams>): BridgeUnitGrams {
  return { ...EMPTY_BRIDGE_UNIT_GRAMS, ...overrides };
}

describe("resolveMassWithBridge", () => {
  it("resolves via the exact-unit tier even when a bridge value is also available, exact wins", () => {
    // "cup" has both an exact reference row (90g) AND a milliliter density
    // (1.2 g/ml, which would bridge to 288g for cup) -- the exact row must
    // win, per the ticket's "a measurement for the actual unit always beats
    // one derived through a volume conversion" rule.
    expect(
      resolveMassWithBridge(
        "cup",
        null,
        90,
        EMPTY_BRIDGE_UNIT_GRAMS,
        bridge({ milliliter: 1.2 }),
      ),
    ).toEqual({ status: "resolved", grams: 90 });
  });

  it("a user override for the exact unit wins over a reference bridge value", () => {
    expect(
      resolveMassWithBridge(
        "cup",
        81,
        null,
        EMPTY_BRIDGE_UNIT_GRAMS,
        bridge({ milliliter: 1.2 }),
      ),
    ).toEqual({ status: "resolved", grams: 81 });
  });

  it("a user override wins within the bridge tier too: user ml bridge beats reference exact-less reference bridge", () => {
    // Neither layer has an exact-unit row; the user's own milliliter
    // density must be used ahead of the reference layer's, same
    // user-before-reference ordering as every other tier.
    expect(
      resolveMassWithBridge(
        "deciliter",
        null,
        null,
        bridge({ milliliter: 1.0 }),
        bridge({ milliliter: 2.0 }),
      ),
    ).toEqual({ status: "resolved", grams: 100 });
  });

  it("the ml bridge resolves a milliliter request from its own density value", () => {
    expect(
      resolveMassWithBridge("milliliter", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 1.02 })),
    ).toEqual({ status: "resolved", grams: 1.02 });
  });

  it("the ml bridge resolves deciliter as density x 100", () => {
    expect(
      resolveMassWithBridge("deciliter", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 1.02 })),
    ).toEqual({ status: "resolved", grams: 102 });
  });

  it("the ml bridge resolves liter as density x 1000", () => {
    expect(
      resolveMassWithBridge("liter", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 1.02 })),
    ).toEqual({ status: "resolved", grams: 1020 });
  });

  it("the ml bridge resolves cup as density x 240", () => {
    expect(
      resolveMassWithBridge("cup", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 1.02 })),
    ).toEqual({ status: "resolved", grams: 244.8 });
  });

  it("the ml bridge resolves fluid_ounce as density x 29.57", () => {
    const result = resolveMassWithBridge(
      "fluid_ounce",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ milliliter: 1.02 }),
    );
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.grams).toBeCloseTo(30.1614, 4);
  });

  it("the spoon bridge resolves a tablespoon request from an eetlepel value (x14.79/15)", () => {
    const result = resolveMassWithBridge(
      "tablespoon",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ eetlepel: 15 }),
    );
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.grams).toBeCloseTo(14.79, 5);
  });

  it("the spoon bridge resolves an eetlepel request from a tablespoon value, the vice-versa direction (x15/14.79)", () => {
    const result = resolveMassWithBridge(
      "eetlepel",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ tablespoon: 14.79 }),
    );
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.grams).toBeCloseTo(15, 5);
  });

  it("the spoon bridge resolves a teaspoon request from a theelepel value (x4.93/5)", () => {
    const result = resolveMassWithBridge(
      "teaspoon",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ theelepel: 5 }),
    );
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.grams).toBeCloseTo(4.93, 5);
  });

  it("the spoon bridge resolves a theelepel request from a teaspoon value, the vice-versa direction (x5/4.93)", () => {
    const result = resolveMassWithBridge(
      "theelepel",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ teaspoon: 4.93 }),
    );
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.grams).toBeCloseTo(5, 5);
  });

  it("prefers the spoon bridge over the ml bridge when both are available at the same tier", () => {
    // A tablespoon request where the same layer has both an eetlepel row
    // (spoon bridge, 14.79g exact-ish) and a milliliter density (which
    // would bridge to a different number) -- the spoon bridge wins per its
    // documented "more trustworthy than a density extrapolation" rationale.
    const result = resolveMassWithBridge(
      "tablespoon",
      null,
      null,
      EMPTY_BRIDGE_UNIT_GRAMS,
      bridge({ eetlepel: 15, milliliter: 5 }),
    );
    expect(result).toEqual({ status: "resolved", grams: 14.79 });
  });

  it("a solid with no milliliter row stays unresolved for liter (no ml row is ever seeded for a solid)", () => {
    expect(
      resolveMassWithBridge("liter", null, null, EMPTY_BRIDGE_UNIT_GRAMS, EMPTY_BRIDGE_UNIT_GRAMS),
    ).toEqual({ status: "unresolved" });
  });

  it("does not bridge a mass-magnitude unit even when a milliliter density is available", () => {
    // "kilogram" is a mass unit -- the ml bridge is volume-only, so a
    // density value must never leak into a mass-unit resolution.
    expect(
      resolveMassWithBridge(
        "kilogram",
        null,
        null,
        EMPTY_BRIDGE_UNIT_GRAMS,
        bridge({ milliliter: 1.02 }),
      ),
    ).toEqual({ status: "unresolved" });
  });

  it("does not bridge a count-magnitude unit", () => {
    expect(
      resolveMassWithBridge("stuk", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 1.02 })),
    ).toEqual({ status: "unresolved" });
  });

  it("never coerces a zero-gram bridged value into unresolved (0 is a valid resolved weight)", () => {
    // Not a realistic density, but the point is structural, same as
    // resolveMass's own zero-gram test above: bridgedGrams must branch on
    // `!== null`, not truthiness, or a legitimate 0-gram bridge result
    // would be silently skipped in favor of "unresolved".
    expect(
      resolveMassWithBridge("milliliter", null, null, EMPTY_BRIDGE_UNIT_GRAMS, bridge({ milliliter: 0 })),
    ).toEqual({ status: "resolved", grams: 0 });
  });

  it("is unresolved when neither an exact row nor any bridge value exists", () => {
    expect(
      resolveMassWithBridge("cup", null, null, EMPTY_BRIDGE_UNIT_GRAMS, EMPTY_BRIDGE_UNIT_GRAMS),
    ).toEqual({ status: "unresolved" });
  });
});
