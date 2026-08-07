import { describe, expect, it } from "vitest";
import {
  EMPTY_KITCHEN_UNIT_MASSES,
  convertToKitchenUnit,
  formatQuantityFraction,
  type KitchenUnitMasses,
} from "../lib/recipes/kitchen-units";
import { convert } from "../lib/recipes/units";

// #164/#157 slice 2 -- kitchen-units.ts is the composition layer ADR-0011 §3
// allows: units.ts's own convert()/convertToUnitSystem stay ingredient-blind
// (tested in recipes-units.test.ts) and are exercised here only through this
// module's own composed functions.

function masses(overrides: Partial<KitchenUnitMasses>): KitchenUnitMasses {
  return { ...EMPTY_KITCHEN_UNIT_MASSES, ...overrides };
}

// Same 2-decimal + Number.EPSILON rounding rule the module uses internally
// (units.ts's roundQuantity, duplicated there) -- used here only to build
// expected values from convert(), not to re-test convert() itself.
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

describe("formatQuantityFraction", () => {
  it("renders every ladder rung exactly for a volume unit", () => {
    const cases: [number, string][] = [
      [1 / 8, "1/8"],
      [1 / 4, "1/4"],
      [1 / 3, "1/3"],
      [3 / 8, "3/8"],
      [1 / 2, "1/2"],
      [5 / 8, "5/8"],
      [2 / 3, "2/3"],
      [3 / 4, "3/4"],
      [7 / 8, "7/8"],
    ];
    for (const [value, text] of cases) {
      expect(formatQuantityFraction(value, "cup", null)).toBe(text);
    }
  });

  it("renders a mixed number (whole + ladder fraction)", () => {
    expect(formatQuantityFraction(1.5, "cup", null)).toBe("1 1/2");
    expect(formatQuantityFraction(2.25, "cup", null)).toBe("2 1/4");
  });

  it("renders a whole number with no trailing fraction", () => {
    expect(formatQuantityFraction(3, "cup", null)).toBe("3");
  });

  it("snaps within the 5% relative tolerance on both sides of a ladder rung", () => {
    // 1/4 == 0.25, so the window is 0.25 * 0.05 ~= 0.0125 either way.
    expect(formatQuantityFraction(0.24, "cup", null)).toBe("1/4");
    expect(formatQuantityFraction(0.26, "cup", null)).toBe("1/4");
  });

  it("falls back to decimal just outside the tolerance, never an approximation", () => {
    expect(formatQuantityFraction(0.23, "cup", null)).toBe("0.23");
    expect(formatQuantityFraction(0.28, "cup", null)).toBe("0.28");
  });

  it("scales the window with the value, so cup-sized conversions read as cooks expect", () => {
    // The case this formatter exists for: 190 g of rice / 185 g per cup.
    // An absolute window would leave these as "1.03" and "2.7".
    expect(formatQuantityFraction(1.03, "cup", null)).toBe("1");
    expect(formatQuantityFraction(2.7, "cup", null)).toBe("2 2/3");
  });

  it("snaps to the NEAREST candidate, not the first one tested", () => {
    // At 10.45 the 5% window is 0.52, wide enough that the bare whole number
    // 10 also qualifies -- but it is 0.45 away while 10 1/2 is only 0.05, so
    // nearest-wins must pick the fraction. A short-circuit that returned the
    // whole number as soon as it fell inside the window would render "10"
    // and silently drop half a cup.
    expect(formatQuantityFraction(10.45, "cup", null)).toBe("10 1/2");
  });

  it("keeps a genuinely un-ladderable decimal as decimal (0.45 stays 0.45)", () => {
    expect(formatQuantityFraction(0.45, "cup", null)).toBe("0.45");
  });

  it("keeps a mass-magnitude quantity decimal even when it's ladder-adjacent", () => {
    // 0.375 is an exact 3/8 for a volume unit but must stay decimal for mass.
    expect(formatQuantityFraction(0.375, "gram", null)).toBe("0.38");
    expect(formatQuantityFraction(1.5, "kilogram", null)).toBe("1.5");
  });

  it("fractions a count-magnitude quantity the same way as volume", () => {
    expect(formatQuantityFraction(0.5, "stuk", null)).toBe("1/2");
  });

  it("keeps quantity === null's existing behaviour (label only, or empty)", () => {
    expect(formatQuantityFraction(null, "cup", "Cup")).toBe("Cup");
    expect(formatQuantityFraction(null, "cup", null)).toBe("");
  });

  it("composes with a label the same way formatQuantity does", () => {
    expect(formatQuantityFraction(0.25, "cup", "Cup")).toBe("1/4 Cup");
    expect(formatQuantityFraction(2, "gram", "Gram")).toBe("2 Gram");
  });
});

describe("convertToKitchenUnit -- 'us' system", () => {
  it("converts a mass quantity to cup when masses.cup resolves", () => {
    const result = convertToKitchenUnit(200, "gram", "us", masses({ cup: 100 }));
    expect(result).toEqual({ quantity: 2, unit: "cup" });
  });

  it("steps down to tablespoon when the cup figure is under 1/4 cup", () => {
    const result = convertToKitchenUnit(24, "gram", "us", masses({ cup: 100 }));
    expect(result.unit).toBe("tablespoon");
    expect(result.quantity).toBe(round(convert(0.24, "cup", "tablespoon")));
  });

  it("does NOT step down at exactly 1/4 cup -- the boundary is exclusive", () => {
    const result = convertToKitchenUnit(25, "gram", "us", masses({ cup: 100 }));
    expect(result).toEqual({ quantity: 0.25, unit: "cup" });
  });

  it("steps down from tablespoon to teaspoon when under 1 tablespoon", () => {
    // gramsPerCup very high (a light spice) so even a full cup's worth of
    // mass lands well under a quarter cup, then well under 1 tablespoon.
    const result = convertToKitchenUnit(1, "gram", "us", masses({ cup: 1000 }));
    const cups = 1 / 1000;
    const tablespoons = convert(cups, "cup", "tablespoon");
    expect(tablespoons).toBeLessThan(1); // sanity: this case really does cross both thresholds
    expect(result.unit).toBe("teaspoon");
    expect(result.quantity).toBe(round(convert(tablespoons, "tablespoon", "teaspoon")));
  });

  it("does NOT step down at exactly 1 tablespoon -- the boundary is exclusive", () => {
    // Pick gramsPerCup so the cup figure converts to exactly 1 tablespoon.
    const gramsPerCup = 100;
    const targetCups = convert(1, "tablespoon", "cup"); // cups worth of exactly 1 tbsp
    const grams = targetCups * gramsPerCup;
    const result = convertToKitchenUnit(grams, "gram", "us", masses({ cup: gramsPerCup }));
    expect(result.unit).toBe("tablespoon");
    expect(result.quantity).toBe(1);
  });

  it("falls back to the existing ounce conversion when no masses are given", () => {
    const result = convertToKitchenUnit(200, "gram", "us");
    expect(result).toEqual({ quantity: 7.05, unit: "ounce" });
  });

  it("falls back to the existing ounce conversion when masses.cup is unresolved", () => {
    const result = convertToKitchenUnit(200, "gram", "us", EMPTY_KITCHEN_UNIT_MASSES);
    expect(result).toEqual({ quantity: 7.05, unit: "ounce" });
  });

  it("leaves an already-US mass unit (ounce) alone even with masses given", () => {
    const result = convertToKitchenUnit(3, "ounce", "us", masses({ cup: 100 }));
    expect(result).toEqual({ quantity: 3, unit: "ounce" });
  });

  it("steps a unit-blind volume->cup conversion down to the spoon a cook reaches for", () => {
    // eetlepel is foreign to "us" but is volume, not mass, so
    // convertToUnitSystem lands it on "cup" directly. 2 eetlepel is 1/8 cup --
    // a measurement nobody performs -- so the ladder must step it down to
    // "2 tablespoon". No density is involved, hence identical with and
    // without masses.
    const withMasses = convertToKitchenUnit(2, "eetlepel", "us", masses({ cup: 100 }));
    const withoutMasses = convertToKitchenUnit(2, "eetlepel", "us");
    expect(withMasses).toEqual(withoutMasses);
    expect(withMasses).toEqual({ quantity: 2.03, unit: "tablespoon" });
  });

  it("keeps a volume->cup conversion at cup once it is a cup-sized amount", () => {
    expect(convertToKitchenUnit(375, "milliliter", "us")).toEqual({
      quantity: 1.56,
      unit: "cup",
    });
  });

  it("passes a count unit through unchanged", () => {
    const result = convertToKitchenUnit(2, "stuk", "us", masses({ cup: 100 }));
    expect(result).toEqual({ quantity: 2, unit: "stuk" });
  });

  it("passes quantity === null through unchanged", () => {
    expect(convertToKitchenUnit(null, "gram", "us", masses({ cup: 100 }))).toEqual({
      quantity: null,
      unit: "gram",
    });
  });
});

describe("convertToKitchenUnit -- 'metric' system", () => {
  it("converts a foreign volume unit (cup) to gram when its mass resolves", () => {
    const result = convertToKitchenUnit(2, "cup", "metric", masses({ cup: 130 }));
    expect(result).toEqual({ quantity: 260, unit: "gram" });
  });

  it("converts a foreign volume unit (tablespoon) to gram via its own resolved mass", () => {
    const result = convertToKitchenUnit(3, "tablespoon", "metric", masses({ tablespoon: 9 }));
    expect(result).toEqual({ quantity: 27, unit: "gram" });
  });

  it("converts a foreign volume unit (fluid_ounce) to gram via its own resolved mass", () => {
    const result = convertToKitchenUnit(2, "fluid_ounce", "metric", masses({ fluid_ounce: 30 }));
    expect(result).toEqual({ quantity: 60, unit: "gram" });
  });

  it("falls back to the existing milliliter conversion when no mass resolves for that unit", () => {
    const result = convertToKitchenUnit(1, "cup", "metric", masses({ tablespoon: 15 }));
    expect(result).toEqual({ quantity: 240, unit: "milliliter" });
  });

  it("falls back to the existing milliliter conversion when no masses are given at all", () => {
    const result = convertToKitchenUnit(1, "cup", "metric");
    expect(result).toEqual({ quantity: 240, unit: "milliliter" });
  });

  it("keeps milliliter/deciliter/liter untouched regardless of masses given (no regression)", () => {
    const withMasses = masses({ cup: 100, tablespoon: 9, teaspoon: 3, fluid_ounce: 30 });
    expect(convertToKitchenUnit(375, "milliliter", "metric", withMasses)).toEqual({
      quantity: 375,
      unit: "milliliter",
    });
    expect(convertToKitchenUnit(2, "deciliter", "metric", withMasses)).toEqual({
      quantity: 2,
      unit: "deciliter",
    });
    expect(convertToKitchenUnit(1, "liter", "metric", withMasses)).toEqual({
      quantity: 1,
      unit: "liter",
    });
  });

  it("leaves eetlepel/theelepel (already-metric volume units) untouched", () => {
    const withMasses = masses({ cup: 100, tablespoon: 9, teaspoon: 3 });
    expect(convertToKitchenUnit(2, "eetlepel", "metric", withMasses)).toEqual({
      quantity: 2,
      unit: "eetlepel",
    });
  });

  it("still converts a foreign mass unit (ounce) to gram directly -- unaffected by masses", () => {
    const result = convertToKitchenUnit(1, "ounce", "metric", masses({ cup: 100 }));
    expect(result).toEqual({ quantity: 28.35, unit: "gram" });
  });

  it("passes quantity === null through unchanged", () => {
    expect(convertToKitchenUnit(null, "cup", "metric", masses({ cup: 100 }))).toEqual({
      quantity: null,
      unit: "cup",
    });
  });
});
