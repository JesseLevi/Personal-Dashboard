import { describe, expect, it } from "vitest";
import { scaleIngredientRow, scaleIngredientRows } from "../lib/recipes/scaling";
import type { RecipeIngredientRow } from "../lib/recipes/types";

// Row-level wiring test for #128 -- the arithmetic itself (rounding,
// null/count handling, InvalidPortionCountError) is already fully covered by
// tests/recipes-units.test.ts against scaleQuantity directly; this file only
// asserts that scaleIngredientRow(s) delegates correctly and degrades safely
// in a render path. See lib/recipes/scaling.ts's header comment.

function makeRow(overrides: Partial<RecipeIngredientRow>): RecipeIngredientRow {
  return {
    id: "ingredient-1",
    user_id: "user-1",
    recipe_id: "recipe-1",
    ingredient_id: null,
    name: "Havermout",
    quantity: 100,
    unit: "gram",
    position: 0,
    group_label: null,
    created_at: "2026-08-03T00:00:00.000Z",
    updated_at: "2026-08-03T00:00:00.000Z",
    ...overrides,
  } as RecipeIngredientRow;
}

describe("scaleIngredientRow", () => {
  it("scales an ordinary quantity up", () => {
    const row = makeRow({ quantity: 100 });
    expect(scaleIngredientRow(row, 4, 8).quantity).toBe(200);
  });

  it("scales an ordinary quantity down", () => {
    const row = makeRow({ quantity: 100 });
    expect(scaleIngredientRow(row, 4, 2).quantity).toBe(50);
  });

  it("scales a count unit (scoop) numerically like any other unit", () => {
    const row = makeRow({ quantity: 2, unit: "scoop" });
    const scaled = scaleIngredientRow(row, 2, 4);
    expect(scaled.quantity).toBe(4);
    expect(scaled.unit).toBe("scoop");
  });

  it("keeps a null quantity ('naar smaak') null, never 0/NaN", () => {
    const row = makeRow({ quantity: null, unit: "naar_smaak" });
    expect(scaleIngredientRow(row, 4, 8).quantity).toBeNull();
  });

  it("scales a fraction-ish design value (1/4 cup -> 3/8 cup, 0.25 -> 0.38)", () => {
    const row = makeRow({ quantity: 0.25, unit: "cup" });
    expect(scaleIngredientRow(row, 4, 6).quantity).toBe(0.38);
  });

  it("is a no-op when target === source, without re-rounding the value", () => {
    const row = makeRow({ quantity: 100 });
    const scaled = scaleIngredientRow(row, 4, 4);
    expect(scaled.quantity).toBe(100);
    expect(scaled).toBe(row);
  });

  it("falls back to the unscaled row instead of throwing for a bad source portion count", () => {
    const row = makeRow({ quantity: 100 });
    expect(() => scaleIngredientRow(row, 0, 4)).not.toThrow();
    expect(scaleIngredientRow(row, 0, 4).quantity).toBe(100);
    expect(() => scaleIngredientRow(row, NaN, 4)).not.toThrow();
    expect(scaleIngredientRow(row, NaN, 4).quantity).toBe(100);
    expect(() => scaleIngredientRow(row, -4, 4)).not.toThrow();
    expect(scaleIngredientRow(row, -4, 4).quantity).toBe(100);
  });

  it("preserves every other field untouched", () => {
    const row = makeRow({ quantity: 100, name: "Bloem", group_label: "Deeg" });
    const scaled = scaleIngredientRow(row, 4, 8);
    expect(scaled.name).toBe("Bloem");
    expect(scaled.group_label).toBe("Deeg");
    expect(scaled.id).toBe(row.id);
  });
});

describe("scaleIngredientRows", () => {
  it("scales every row in a list the same way", () => {
    const rows = [
      makeRow({ id: "a", quantity: 100 }),
      makeRow({ id: "b", quantity: 2, unit: "scoop" }),
      makeRow({ id: "c", quantity: null, unit: "naar_smaak" }),
    ];
    const scaled = scaleIngredientRows(rows, 4, 8);
    expect(scaled.map((row) => row.quantity)).toEqual([200, 4, null]);
  });

  it("is a no-op list when target === source and no unitSystem is given", () => {
    const rows = [makeRow({ id: "a", quantity: 100 })];
    expect(scaleIngredientRows(rows, 4, 4)).toBe(rows);
  });

  it("degrades to unscaled rows for a bad source portion count instead of throwing", () => {
    const rows = [makeRow({ id: "a", quantity: 100 }), makeRow({ id: "b", quantity: 2, unit: "scoop" })];
    expect(() => scaleIngredientRows(rows, 0, 4)).not.toThrow();
    expect(scaleIngredientRows(rows, 0, 4).map((row) => row.quantity)).toEqual([100, 2]);
  });
});

// #160: unit-system conversion composed with portion scaling, one pass.
describe("scaleIngredientRow(s) with unitSystem", () => {
  it("scales, then converts to the target system's flagship unit", () => {
    const row = makeRow({ quantity: 100, unit: "gram" });
    // 100g at 4 portions -> 200g at 8 portions -> converted to ounces.
    const scaled = scaleIngredientRow(row, 4, 8, "us");
    expect(scaled.unit).toBe("ounce");
    expect(scaled.quantity).toBe(7.05);
  });

  it("still converts even when portions are unchanged", () => {
    const row = makeRow({ quantity: 1, unit: "liter" });
    const scaled = scaleIngredientRow(row, 4, 4, "metric");
    expect(scaled).toEqual({ ...row, quantity: 1000, unit: "milliliter" });
  });

  it("leaves a count unit's unit unchanged while still scaling its quantity", () => {
    const row = makeRow({ quantity: 2, unit: "scoop" });
    const scaled = scaleIngredientRow(row, 2, 4, "us");
    expect(scaled.quantity).toBe(4);
    expect(scaled.unit).toBe("scoop");
  });

  it("scaleIngredientRows applies the same composed conversion to every row", () => {
    const rows = [
      makeRow({ id: "a", quantity: 1, unit: "kilogram" }),
      makeRow({ id: "b", quantity: 2, unit: "scoop" }),
    ];
    const scaled = scaleIngredientRows(rows, 1, 1, "us");
    expect(scaled.map((row) => ({ quantity: row.quantity, unit: row.unit }))).toEqual([
      { quantity: 35.27, unit: "ounce" },
      { quantity: 2, unit: "scoop" },
    ]);
  });

  it("is not a no-op list when a unitSystem is given, even if target === source", () => {
    const rows = [makeRow({ id: "a", quantity: 1, unit: "liter" })];
    const scaled = scaleIngredientRows(rows, 4, 4, "metric");
    expect(scaled).not.toBe(rows);
    expect(scaled[0].unit).toBe("milliliter");
  });
});
