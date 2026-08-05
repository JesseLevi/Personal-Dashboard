// Row-level portion scaling for the recipe detail page (#128, Phase 4 wave
// 5). Thin render-safe wrapper around #120's scaleQuantity -- this module
// does no arithmetic of its own, it only maps scaleQuantity over a recipe's
// ingredient rows and degrades safely for a render path. See
// design/notes/RecipeDetailPage.md's "Portion stepper" entry for the ticket
// history; this comment covers only what isn't already there.
//
// -- Never throws in a render path --------------------------------------
// scaleQuantity throws InvalidPortionCountError for a non-positive/non-finite
// portion count. The DB guarantees recipes.servings > 0 (`check (servings >
// 0)`, supabase/migrations/20260730000002_recipe_schema.sql) and
// PortionStepper floors its own value at 1 (#153), so sourcePortions/
// targetPortions should never actually be invalid here. But a render
// function degrading to a thrown error instead of unscaled numbers would
// turn a defensive backstop into a page-crashing bug the moment either
// guarantee is ever violated (a future migration relaxes the check, a
// future caller reuses this without the stepper's floor). scaleRecipe*
// catches InvalidPortionCountError and falls back to the row's own source
// quantity unchanged, so the page still renders instead of crashing.
//
// -- count units, portion scaling never touches convert() -----------------
// scaleQuantity has no notion of unit at all -- it just scales the number.
// count units (stuk, scoop, snufje, naar_smaak) scale numerically like any
// other unit but must never cross the mass<->volume magnitude layer.
//
// -- unit-system conversion, added #160 ------------------------------------
// #160's "Pas aan" panel is the UI entry point docs/open-questions.md's
// former metric-imperial-conversion-has-no-ui-entry-point named as missing
// (now resolved/removed there). `scaleIngredientRow(s)` below takes an
// optional `unitSystem` and, when given one, applies `units.ts`'s own
// `convertToUnitSystem` AFTER scaling -- one composed pass, not two
// independent ones, so the ingredient cards and the per-step `Tag`s (both
// fed from RecipeDetailPage.tsx's one shared list) always show the same
// scaled-and-converted numbers. Still no import from
// lib/recipes/mass-resolution.ts (ADR-0011 §3's ingredient-specific mass
// lookup) -- `convertToUnitSystem` stays same-magnitude-only, same as the
// `convert()` it wraps.

import type { RecipeIngredientRow } from "@/lib/recipes/types";
import { InvalidPortionCountError, convertToUnitSystem, scaleQuantity, type UnitSystem } from "@/lib/recipes/units";

/** Scales a single ingredient row's `quantity` from `sourcePortions` to
 * `targetPortions`, then (if `unitSystem` is given) converts the result to
 * that system's flagship unit for the row's magnitude -- see the module
 * header. Keeps every other field (name, group_label, ...) untouched.
 * Identity fast-path when neither operation would change anything, so a
 * page at its initial render does zero redundant rounding. */
export function scaleIngredientRow<T extends Pick<RecipeIngredientRow, "quantity" | "unit">>(
  ingredient: T,
  sourcePortions: number,
  targetPortions: number,
  unitSystem?: UnitSystem,
): T {
  if (targetPortions === sourcePortions && !unitSystem) return ingredient;
  let quantity = ingredient.quantity;
  if (targetPortions !== sourcePortions) {
    try {
      quantity = scaleQuantity(quantity, sourcePortions, targetPortions);
    } catch (error) {
      if (!(error instanceof InvalidPortionCountError)) throw error;
      quantity = ingredient.quantity;
    }
  }
  if (!unitSystem) return { ...ingredient, quantity };
  const converted = convertToUnitSystem(quantity, ingredient.unit, unitSystem);
  return { ...ingredient, quantity: converted.quantity, unit: converted.unit };
}

/** Scales (and, given `unitSystem`, converts) every row in a recipe's
 * ingredient list the same way -- the function the detail page actually
 * calls, once per render, to feed both the ingredient cards and the
 * per-step Tags from one shared, already-scaled-and-converted list rather
 * than recomputing per call site. */
export function scaleIngredientRows<T extends Pick<RecipeIngredientRow, "quantity" | "unit">>(
  ingredients: readonly T[],
  sourcePortions: number,
  targetPortions: number,
  unitSystem?: UnitSystem,
): T[] {
  if (targetPortions === sourcePortions && !unitSystem) return ingredients as T[];
  return ingredients.map((ingredient) =>
    scaleIngredientRow(ingredient, sourcePortions, targetPortions, unitSystem),
  );
}
