// Per-person recipe nutrition (#160 part 1; the row that renders it is part
// 2). Pure and framework-free, same house style as units.ts/scaling.ts/
// mass-resolution.ts: no Supabase import, testable without a database
// (tests/recipes-nutrition.test.ts), safe to import from client code.
//
// -- Two separate mechanisms, do not merge (ADR-0011 §3, units.ts's own
// header) --------------------------------------------------------------
// Mass-magnitude units (gram/kilogram/ounce/pound) convert to grams
// deterministically via units.ts's `convert()` -- no lookup needed.
// Volume/count-magnitude units need a per-(ingredient, unit) gram lookup
// (reference.ingredient_unit_masses / public.ingredient_unit_masses,
// resolved user-override-first by mass-resolution.ts's `resolveMass`) that
// only the Supabase-dependent lib/recipes/queries.ts can perform. This
// module never does that lookup itself -- it takes the already-resolved
// grams-per-unit as an input (`unitMassGrams` below) and only multiplies.
//
// -- NULL means unknown, never 0 (ADR-0011 §4) ---------------------------
// A `null` anywhere in a row's inputs (quantity, unitMassGrams, or any one
// of the five nutrient columns) makes that row's contribution to that
// nutrient `null`. Totals sum the KNOWN contributions only (user decision
// 2026-10-07, replacing "one unknown row nulls the total"): an unknown row
// is left out, never counted as 0, and that is never silent -- the summary
// below reports which rows were counted, and the detail page marks the
// rest "niet meegeteld" with a counted/total line under the macros. A total
// with no known contribution at all stays `null` ("?"). NEVO's import
// (#161, ADR-0013) fills kcal/protein/carbs/fat/fiber for 2328
// `reference.ingredients` rows; an unlinked ingredient (or a `per_100ml`
// row, ADR-0013 §4) resolves to EMPTY_NUTRIENTS and is not counted.
//
// -- Fibre (#166) ----------------------------------------------------------
// `fiberGPer100g`/`fiberG` are computed the same way as the other four
// nutrients -- one shared calculation layer, one set of null-propagation
// rules. Figma's NutritionalData row gained a sixth button (`Icon/Leafy-
// green`, node 4025:11826) in #166; `NutritionalDataRow.tsx` now renders it.

import {
  convert,
  InvalidPortionCountError,
  magnitudeOf,
  type MassUnitCode,
  type UnitCode,
} from "@/lib/recipes/units";

export interface IngredientNutrients {
  kcalPer100g: number | null;
  proteinGPer100g: number | null;
  carbsGPer100g: number | null;
  fatGPer100g: number | null;
  fiberGPer100g: number | null;
}

/**
 * One recipe ingredient row's inputs to the nutrition calculation.
 * `unitMassGrams` is grams for ONE unit of `unit` -- only meaningful for
 * volume/count-magnitude units (ADR-0011 §3); mass-magnitude units convert
 * via `convert()` and ignore this field, so a caller need not resolve it
 * for those rows (pass `null`).
 */
export interface RecipeIngredientNutritionInput {
  quantity: number | null;
  unit: UnitCode;
  unitMassGrams: number | null;
  nutrients: IngredientNutrients;
}

export interface NutritionAmounts {
  kcal: number | null;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

/** All-unknown nutrients — the fallback for an ingredient row with no
 * `reference.ingredients` link, and what a `per_100ml` reference row also
 * resolves to (ADR-0013 §4 -- its numbers must never be fed into per-100g
 * math). Exported so queries.ts (the DB-touching shell) and dev-only
 * fixtures share one definition instead of re-typing five `null`s in
 * multiple places. */
export const EMPTY_NUTRIENTS: IngredientNutrients = {
  kcalPer100g: null,
  proteinGPer100g: null,
  carbsGPer100g: null,
  fatGPer100g: null,
  fiberGPer100g: null,
};

function isMassUnit(unit: UnitCode): unit is MassUnitCode {
  return magnitudeOf(unit) === "mass";
}

/**
 * Total grams one ingredient row contributes, or `null` if unknown.
 * `quantity === null` ("naar smaak", the same case `scaleQuantity` treats
 * specially) makes the grams unknown too -- there is nothing to weigh.
 */
export function resolveIngredientGrams(
  quantity: number | null,
  unit: UnitCode,
  unitMassGrams: number | null,
): number | null {
  if (quantity === null) return null;
  if (isMassUnit(unit)) return convert(quantity, unit, "gram");
  if (unitMassGrams === null) return null;
  return quantity * unitMassGrams;
}

// Branches on `!== null`, not truthiness -- a legitimate 0 kcal/carbs/
// protein/fat-per-100g value (e.g. water) must not be read as unknown, the
// same pitfall mass-resolution.ts's `resolveMass` guards against for grams.
function contribution(grams: number | null, per100g: number | null): number | null {
  if (grams === null || per100g === null) return null;
  return (grams / 100) * per100g;
}

/** One ingredient row's resolved kcal/carbs/protein/fat/fiber contribution.
 * Each nutrient is resolved independently, so e.g. kcal can be known while
 * protein is unknown -- a row can be missing just one of the five columns. */
export function resolveIngredientNutrition(
  input: RecipeIngredientNutritionInput,
): NutritionAmounts {
  const grams = resolveIngredientGrams(input.quantity, input.unit, input.unitMassGrams);
  return {
    kcal: contribution(grams, input.nutrients.kcalPer100g),
    carbsG: contribution(grams, input.nutrients.carbsGPer100g),
    proteinG: contribution(grams, input.nutrients.proteinGPer100g),
    fatG: contribution(grams, input.nutrients.fatGPer100g),
    fiberG: contribution(grams, input.nutrients.fiberGPer100g),
  };
}

// Sum of the known values; unknown ones are left out (module header). `null`
// only when values exist but none is known. An empty list sums to 0
// (vacuously known), not `null`.
function sumKnown(values: readonly (number | null)[]): number | null {
  let total = 0;
  let known = 0;
  for (const value of values) {
    if (value === null) continue;
    total += value;
    known += 1;
  }
  return values.length > 0 && known === 0 ? null : total;
}

// Same rounding rule as units.ts's roundQuantity (2 decimals, with the
// standard `+ Number.EPSILON` binary-floating-point correction) -- one
// shared display precision for every quantity this domain renders.
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Display-only rounding to whole numbers (#166): the computed and stored
 * values above keep their 2-decimal precision, only the rendered figure is
 * whole. `null` passes straight through -- an unresolvable macro must stay
 * unresolvable and render "?", never a fabricated `0` (ADR-0013 §4). A
 * genuinely tiny value (0.4 g of fibre) does round to `0`, which is a real
 * measurement rendered at the requested precision, not an unknown.
 */
export function roundMacroForDisplay(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

/**
 * Per-person kcal/carbs/protein/fat/fiber for a whole recipe: sums every
 * ingredient row's known contribution (see `sumKnown` -- an unknown one is
 * left out, see `summarizeRecipeNutrition` for which), then divides by
 * `servings`. `servings` mirrors `scaleQuantity`'s own
 * invariant (the DB's `recipes.servings > 0` check) and throws the same
 * `InvalidPortionCountError` rather than dividing by zero if it is ever
 * violated.
 */
export function computeRecipeNutritionPerPerson(
  ingredients: readonly RecipeIngredientNutritionInput[],
  servings: number,
): NutritionAmounts {
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new InvalidPortionCountError();
  }
  const perIngredient = ingredients.map(resolveIngredientNutrition);
  const totals: NutritionAmounts = {
    kcal: sumKnown(perIngredient.map((row) => row.kcal)),
    carbsG: sumKnown(perIngredient.map((row) => row.carbsG)),
    proteinG: sumKnown(perIngredient.map((row) => row.proteinG)),
    fatG: sumKnown(perIngredient.map((row) => row.fatG)),
    fiberG: sumKnown(perIngredient.map((row) => row.fiberG)),
  };
  return {
    kcal: totals.kcal === null ? null : round(totals.kcal / servings),
    carbsG: totals.carbsG === null ? null : round(totals.carbsG / servings),
    proteinG: totals.proteinG === null ? null : round(totals.proteinG / servings),
    fatG: totals.fatG === null ? null : round(totals.fatG / servings),
    fiberG: totals.fiberG === null ? null : round(totals.fiberG / servings),
  };
}

/**
 * Whether a row is in the totals: its grams and its kcal are known. A row
 * without a quantity ("naar smaak") is `"no-amount"`: there is nothing to
 * weigh, so it is neither counted nor reported as missing.
 */
export type NutritionRowStatus = "counted" | "not-counted" | "no-amount";

export function nutritionRowStatus(input: RecipeIngredientNutritionInput): NutritionRowStatus {
  if (input.quantity === null) return "no-amount";
  return resolveIngredientNutrition(input).kcal === null ? "not-counted" : "counted";
}

export interface RecipeNutritionSummary {
  perPerson: NutritionAmounts;
  /** Index-aligned with the input rows. */
  rowStatus: NutritionRowStatus[];
  /** Rows in the totals, out of the rows that have an amount. */
  counted: number;
  countable: number;
}

/** Per-person totals plus which rows they are based on, for the "x van y" line and the per-row marker. */
export function summarizeRecipeNutrition(
  ingredients: readonly RecipeIngredientNutritionInput[],
  servings: number,
): RecipeNutritionSummary {
  const perPerson = computeRecipeNutritionPerPerson(ingredients, servings);
  const rowStatus = ingredients.map(nutritionRowStatus);
  return {
    perPerson,
    rowStatus,
    counted: rowStatus.filter((status) => status === "counted").length,
    countable: rowStatus.filter((status) => status !== "no-amount").length,
  };
}
