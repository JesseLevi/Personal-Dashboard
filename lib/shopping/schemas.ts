import { z } from "zod";
import { isUnitCode } from "@/lib/recipes/units";

// Validates every server-action input in app/(app)/winkelmand/actions.ts
// (#176), same pattern and same split (shape/format here, ownership checked
// separately against the database) as lib/recipes/schemas.ts.

const name = z.string().trim().min(1).max(200);

// shopping_list_items.unit is nullable public.recipe_unit (#175, reused
// from #130) -- validated through isUnitCode's canonical UNIT_CODES list
// (#120), never a fresh, hand-copied literal list. Nullable because a
// manually-typed item ("melk") may carry no unit at all, unlike
// recipe_ingredients.unit.
const unit = z
  .string()
  .refine(isUnitCode, { message: "Invalid unit code" })
  .nullable();

// Nullable + positive when present -- mirrors shopping_list_items' own
// `check (quantity is null or quantity > 0)`
// (20260808000001_shopping_list_items.sql), same reasoning as
// lib/recipes/schemas.ts's `quantity`.
const quantity = z.number().positive().nullable();

// Supermarket-section grouping (Architecture §4.2). Stored but not rendered
// by any ticket yet -- see the migration's file header.
const section = z.string().trim().min(1).max(100).nullable();

export const addShoppingListItemSchema = z.object({
  name,
  quantity: quantity.optional().default(null),
  unit: unit.optional().default(null),
  section: section.optional().default(null),
});

export const toggleShoppingListItemSchema = z.object({
  id: z.uuid(),
  checked: z.boolean(),
});

export const deleteShoppingListItemSchema = z.object({
  id: z.uuid(),
});

// #178: the Recepten -> Boodschappenlijst hand-off. `targetPortions` mirrors
// createRecipeSchema/updateRecipeSchema's own `servings` validation
// (`z.int().positive()`, lib/recipes/schemas.ts) -- the same "portion count"
// concept, just supplied by the caller at send time instead of stored.
export const sendRecipeToShoppingListSchema = z.object({
  recipeId: z.uuid(),
  targetPortions: z.int().positive(),
});

// #179 part 2: the swipe-to-cart single-ingredient add -- same shape as
// sendRecipeToShoppingListSchema plus which of the recipe's own
// recipe_ingredients rows to send (a real FK to that table, not free text).
export const addIngredientToShoppingListSchema = z.object({
  recipeId: z.uuid(),
  ingredientId: z.uuid(),
  targetPortions: z.int().positive(),
});
