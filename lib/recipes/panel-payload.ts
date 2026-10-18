import type { UnitCode } from "@/lib/recipes/units";

// Pure save-payload logic of RecipePanel (#126/#149, extended #318), split out
// so it is unit-testable without a DOM. The panel's local row state in, the
// `ingredients`/`steps` arrays of createRecipe/updateRecipe out.

export interface IngredientRowState {
  localId: string;
  name: string;
  quantity: number | null;
  unit: UnitCode | "";
  ingredientId: string | null;
  /** The `recipe_ingredients.id` this row was loaded from (edit mode only) — seeds a step's `ingredientLocalIds` from the recipe's own `steps[].ingredientIds` (#149). Never sent in the save payload; `null` for a freshly typed/added row. */
  sourceId: string | null;
  /** `recipe_ingredients.group_label`, carried through so a manual save does not erase an imported group heading. */
  groupLabel: string | null;
  /** The saved `needs_review` flag (#318): a save only clears it on a line the user changed or confirmed. */
  needsReview: boolean;
  /** What the nutrition calculator uses for this row, shown under it in the panel. `null` when unlinked. `kcalPer100g`/`gramsPerUnit` are only known as loaded from the server (null after a fresh pick); `gramsPerUnit` is grams for one `unit` as loaded. */
  link: { name: string; isNevo: boolean; kcalPer100g: number | null; gramsPerUnit: number | null; unit: UnitCode | "" } | null;
  /** Name/quantity/unit/link as loaded, to tell a touched row from an untouched one. `null` for a new row. */
  loaded: { name: string; quantity: number | null; unit: UnitCode | ""; ingredientId: string | null } | null;
}

export interface StepRowState {
  localId: string;
  instruction: string;
  /** Selected ingredient rows for this step, by their local `IngredientRowState.localId` — translated into payload `ingredientRefs` (indexes) at save time. */
  ingredientLocalIds: string[];
}

/** True while the row still carries its imported `needs_review` flag AND the user has not touched it. */
export function keepsNeedsReview(row: IngredientRowState): boolean {
  if (!row.needsReview || !row.loaded) return false;
  return (
    row.name === row.loaded.name &&
    row.quantity === row.loaded.quantity &&
    row.unit === row.loaded.unit &&
    row.ingredientId === row.loaded.ingredientId
  );
}

// Ingredients/steps are built together, not by two independent filters
// (#149): a step's `ingredientRefs` are indexes into the payload's
// `ingredients` array, and that array only contains rows that survive the
// empty-name filter — so the index map must be built from the FILTERED list.
export function buildContentsPayload(ingredients: IngredientRowState[], steps: StepRowState[]) {
  const filteredIngredients = ingredients.filter((row) => row.name.trim() !== "");
  const indexByLocalId = new Map(filteredIngredients.map((row, index) => [row.localId, index]));
  return {
    ingredients: filteredIngredients.map((row) => ({
      name: row.name.trim(),
      quantity: row.quantity,
      unit: row.unit || "gram",
      ingredientId: row.ingredientId,
      groupLabel: row.groupLabel,
      needsReview: keepsNeedsReview(row),
    })),
    steps: steps
      .filter((row) => row.instruction.trim() !== "")
      .map((row) => ({
        instruction: row.instruction.trim(),
        ingredientRefs: row.ingredientLocalIds
          .map((localId) => indexByLocalId.get(localId))
          .filter((index): index is number => index !== undefined),
      })),
  };
}

/**
 * New list with the row at `index` moved one place (`-1` up, `1` down). The
 * panel's array order IS the saved order: `replace_recipe_contents` numbers
 * `recipe_steps.position` from the array index on every save, so no position
 * math lives client-side. Out-of-range moves return the list unchanged.
 */
export function moveRow<T>(rows: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}
