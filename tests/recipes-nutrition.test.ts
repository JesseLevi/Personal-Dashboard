import { describe, expect, it } from "vitest";
import {
  computeRecipeNutritionPerPerson,
  resolveIngredientGrams,
  resolveIngredientNutrition,
  type RecipeIngredientNutritionInput,
} from "../lib/recipes/nutrition";
import { InvalidPortionCountError } from "../lib/recipes/units";

// Unit tests for #160's pure nutrition-calculation layer. Fixtures use
// round numbers throughout (grams and per-100g values that divide evenly)
// so assertions compare exact values rather than floating-point
// approximations — the rounding rule itself is covered separately by
// units.ts's own roundQuantity tests, not re-verified here.

// 200 g at 100 kcal/carb20/protein10/fat5 per 100 g -> 200/40/20/10.
const knownGram: RecipeIngredientNutritionInput = {
  quantity: 200,
  unit: "gram",
  unitMassGrams: null,
  nutrients: { kcalPer100g: 100, carbsGPer100g: 20, proteinGPer100g: 10, fatGPer100g: 5 },
};

// 2 stuk at 50 g/stuk = 100 g, at 200 kcal/carb0(legit zero)/protein8/fat2
// per 100 g -> 200/0/8/2.
const knownCount: RecipeIngredientNutritionInput = {
  quantity: 2,
  unit: "stuk",
  unitMassGrams: 50,
  nutrients: { kcalPer100g: 200, carbsGPer100g: 0, proteinGPer100g: 8, fatGPer100g: 2 },
};

describe("resolveIngredientGrams", () => {
  it("converts mass-magnitude units directly via units.ts's convert(), no lookup needed", () => {
    expect(resolveIngredientGrams(1.5, "kilogram", null)).toBe(1500);
  });

  it("multiplies quantity by the caller-resolved grams-per-unit for volume/count magnitude units", () => {
    expect(resolveIngredientGrams(2, "stuk", 50)).toBe(100);
  });

  it("is unknown (null), not zero, when a volume/count unit's grams-per-unit is unresolved", () => {
    expect(resolveIngredientGrams(1, "cup", null)).toBeNull();
  });

  it("is unknown when quantity is null (\"naar smaak\") -- nothing to weigh", () => {
    expect(resolveIngredientGrams(null, "gram", null)).toBeNull();
    expect(resolveIngredientGrams(null, "stuk", 50)).toBeNull();
  });
});

describe("resolveIngredientNutrition", () => {
  it("computes all four macros for a fully-known mass-unit row (happy path)", () => {
    expect(resolveIngredientNutrition(knownGram)).toEqual({
      kcal: 200,
      carbsG: 40,
      proteinG: 20,
      fatG: 10,
    });
  });

  it("computes all four macros for a fully-known count-unit row via its resolved grams-per-unit", () => {
    expect(resolveIngredientNutrition(knownCount)).toEqual({
      kcal: 200,
      carbsG: 0,
      proteinG: 8,
      fatG: 2,
    });
  });

  it("never coerces a legitimate zero per-100g value into unknown (water/zero-carb ingredients)", () => {
    const zeroEverything: RecipeIngredientNutritionInput = {
      quantity: 100,
      unit: "gram",
      unitMassGrams: null,
      nutrients: { kcalPer100g: 0, carbsGPer100g: 0, proteinGPer100g: 0, fatGPer100g: 0 },
    };
    expect(resolveIngredientNutrition(zeroEverything)).toEqual({
      kcal: 0,
      carbsG: 0,
      proteinG: 0,
      fatG: 0,
    });
  });

  it("resolves only the unknown nutrient to null, leaving the other three known (a row can be missing just one column)", () => {
    const missingCarbsOnly: RecipeIngredientNutritionInput = {
      ...knownGram,
      nutrients: { ...knownGram.nutrients, carbsGPer100g: null },
    };
    expect(resolveIngredientNutrition(missingCarbsOnly)).toEqual({
      kcal: 200,
      carbsG: null,
      proteinG: 20,
      fatG: 10,
    });
  });

  it("is unknown for every nutrient when the row's grams are unresolved (unresolved mass)", () => {
    const unresolvedMass: RecipeIngredientNutritionInput = {
      quantity: 1,
      unit: "cup",
      unitMassGrams: null,
      nutrients: { kcalPer100g: 389, carbsGPer100g: 66, proteinGPer100g: 17, fatGPer100g: 7 },
    };
    expect(resolveIngredientNutrition(unresolvedMass)).toEqual({
      kcal: null,
      carbsG: null,
      proteinG: null,
      fatG: null,
    });
  });
});

describe("computeRecipeNutritionPerPerson", () => {
  it("sums every row's contribution then divides by servings (happy path)", () => {
    // Totals: kcal 400, carbs 40, protein 28, fat 12 -- servings 2 -> halved.
    expect(computeRecipeNutritionPerPerson([knownGram, knownCount], 2)).toEqual({
      kcal: 200,
      carbsG: 20,
      proteinG: 14,
      fatG: 6,
    });
  });

  it("divides correctly for a different serving count", () => {
    expect(computeRecipeNutritionPerPerson([knownGram, knownCount], 4)).toEqual({
      kcal: 100,
      carbsG: 10,
      proteinG: 7,
      fatG: 3,
    });
  });

  it("is unknown (null) for a nutrient the moment any single ingredient's value for it is unknown, even with other known ingredients present", () => {
    const missingProtein: RecipeIngredientNutritionInput = {
      ...knownCount,
      nutrients: { ...knownCount.nutrients, proteinGPer100g: null },
    };
    const totals = computeRecipeNutritionPerPerson([knownGram, missingProtein], 2);
    expect(totals.proteinG).toBeNull();
    // The other three macros stay known -- one unknown ingredient value
    // doesn't null out unrelated nutrients or unrelated rows.
    expect(totals.kcal).toBe(200);
    expect(totals.carbsG).toBe(20);
    expect(totals.fatG).toBe(6);
  });

  it("is unknown when any row's grams are unresolved, never a silent sum of the known subset", () => {
    const unresolved: RecipeIngredientNutritionInput = {
      quantity: 1,
      unit: "cup",
      unitMassGrams: null,
      nutrients: { kcalPer100g: 389, carbsGPer100g: 66, proteinGPer100g: 17, fatGPer100g: 7 },
    };
    const totals = computeRecipeNutritionPerPerson([knownGram, unresolved], 2);
    expect(totals).toEqual({ kcal: null, carbsG: null, proteinG: null, fatG: null });
  });

  it("is all-zero (known), not null, for an empty ingredient list -- vacuously nothing is unknown", () => {
    expect(computeRecipeNutritionPerPerson([], 4)).toEqual({
      kcal: 0,
      carbsG: 0,
      proteinG: 0,
      fatG: 0,
    });
  });

  it("throws InvalidPortionCountError for a non-positive servings count, same invariant scaleQuantity guards", () => {
    expect(() => computeRecipeNutritionPerPerson([knownGram], 0)).toThrow(InvalidPortionCountError);
    expect(() => computeRecipeNutritionPerPerson([knownGram], -1)).toThrow(InvalidPortionCountError);
    expect(() => computeRecipeNutritionPerPerson([knownGram], Number.NaN)).toThrow(
      InvalidPortionCountError,
    );
  });
});
