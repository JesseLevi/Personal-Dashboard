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
// -- count units, never touching convert() -------------------------------
// scaleQuantity has no notion of unit at all -- it just scales the number.
// This module deliberately imports nothing from convert()/mass-resolution.ts
// (ADR-0011 §3): count units (stuk, scoop, snufje, naar_smaak) scale
// numerically like any other unit but must never cross the mass<->volume
// magnitude layer, and there is no UI entry point for that layer in this
// ticket (see docs/open-questions.md's shared conversion-toggle entry).

import type { RecipeIngredientRow } from "@/lib/recipes/types";
import { InvalidPortionCountError, scaleQuantity } from "@/lib/recipes/units";

/** Scales a single ingredient row's `quantity` from `sourcePortions` to
 * `targetPortions`, keeping every other field (unit, name, group_label, ...)
 * untouched. Identity fast-path when the counts already match, so a page at
 * its initial render does zero redundant rounding. */
export function scaleIngredientRow<T extends Pick<RecipeIngredientRow, "quantity">>(
  ingredient: T,
  sourcePortions: number,
  targetPortions: number,
): T {
  if (targetPortions === sourcePortions) return ingredient;
  try {
    return { ...ingredient, quantity: scaleQuantity(ingredient.quantity, sourcePortions, targetPortions) };
  } catch (error) {
    if (error instanceof InvalidPortionCountError) return ingredient;
    throw error;
  }
}

/** Scales every row in a recipe's ingredient list the same way -- the
 * function the detail page actually calls, once per render, to feed both the
 * ingredient cards and the per-step Tags from one shared, already-scaled
 * list rather than recomputing per call site. */
export function scaleIngredientRows<T extends Pick<RecipeIngredientRow, "quantity">>(
  ingredients: readonly T[],
  sourcePortions: number,
  targetPortions: number,
): T[] {
  if (targetPortions === sourcePortions) return ingredients as T[];
  return ingredients.map((ingredient) =>
    scaleIngredientRow(ingredient, sourcePortions, targetPortions),
  );
}
