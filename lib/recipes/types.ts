import type { Database } from "@/lib/database.types";
import type { KitchenUnitMasses } from "@/lib/recipes/kitchen-units";
import type { IngredientNutrients } from "@/lib/recipes/nutrition";

// Read-side shapes returned by lib/recipes/queries.ts, plus the write-side
// ActionResult/RecipesErrorCode contract for app/(app)/recepten/actions.ts
// -- same split as lib/boards/types.ts (#92).

export type RecipeCategoryRow = Database["public"]["Tables"]["recipe_categories"]["Row"];
export type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type RecipeStepRow = Database["public"]["Tables"]["recipe_steps"]["Row"];
// #149: step <-> ingredient join row (public.recipe_step_ingredients).
export type RecipeStepIngredientRow =
  Database["public"]["Tables"]["recipe_step_ingredients"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];
export type RecipeTagRow = Database["public"]["Tables"]["recipe_tags"]["Row"];

// ADR-0011's two-layer ingredient library. IngredientRow is the per-user
// public.ingredients row every recipe_ingredients.ingredient_id FK actually
// points at; ReferenceIngredientRow is the shared, read-only
// reference.ingredients row it may optionally link to.
export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];
export type ReferenceIngredientRow = Database["reference"]["Tables"]["ingredients"]["Row"];

// #149: which of the recipe's own recipe_ingredients rows this step links
// to, ordered by the link's own `position` (Figma 3778:5467's Tags). Plain
// ids, not embedded rows -- the recipe's full ingredient list is already
// available on the parent RecipeWithIngredientsAndSteps, so the detail page
// looks each id up there rather than this carrying a second copy of the row.
export type RecipeStepWithIngredients = RecipeStepRow & { ingredientIds: string[] };

// #160 part 1: the nutrition inputs getRecipeWithIngredientsAndSteps now
// attaches to each ingredient row, feeding lib/recipes/nutrition.ts's
// computeRecipeNutritionPerPerson (part 2 renders the actual row). Both
// fields are all-null for a row with no `ingredient_id` link or no
// resolvable data -- "unknown", never "zero" (ADR-0011 §4).
export type RecipeIngredientWithNutrition = RecipeIngredientRow & {
  /** `reference.ingredients`' nutrient-per-100g columns for this row's linked ingredient (NEVO-online 2025/9.0, ADR-0013). All-null for an unlinked row or a `per_100ml` reference row (ADR-0013 §4). */
  nutrients: IngredientNutrients;
  /** Grams for ONE unit of this row's `unit`, resolved user-override-then-reference (ADR-0011 §3, mass-resolution.ts's `resolveMass`). Only meaningful for volume/count magnitude units -- nutrition.ts converts mass units itself and ignores this field for those rows. */
  unitMassGrams: number | null;
  /** #164/#157 slice 2: grams-per-cup/tablespoon/teaspoon/fluid_ounce for this row's ingredient, resolved the same batched way as `unitMassGrams` (queries.ts's `kitchenUnitMassesFor`, no second round trip). Feeds `lib/recipes/kitchen-units.ts`'s `convertToKitchenUnit` -- all-null for an unlinked row, same "unknown, never zero" rule as `unitMassGrams`. */
  kitchenUnitMasses: KitchenUnitMasses;
  /** #179: `public.ingredients.reference_id` for this row's linked ingredient -- the same lookup `nutrients` already resolves, exposed directly so `sendRecipeToShoppingList` (app/(app)/winkelmand/actions.ts) can carry it onto `shopping_list_items.reference_ingredient_id` without a second round trip. Null for an unlinked row. */
  referenceIngredientId: string | null;
  /** Name of the linked library ingredient (for a NEVO one its NEVO name, e.g. "Selderij bleek- rauw"), shown in the edit panel so a wrong link is visible. Null for an unlinked row. */
  linkedIngredientName: string | null;
};

export type RecipeWithIngredientsAndSteps = RecipeRow & {
  ingredients: RecipeIngredientWithNutrition[];
  steps: RecipeStepWithIngredients[];
};
export type CategoryWithRecipes = RecipeCategoryRow & { recipes: RecipeRow[] };

// ADR-0011 §3's mass-resolution outcome (resolveIngredientUnitMass in
// queries.ts). "unresolved" is a first-class branch, never a null/0 grams
// value coerced into a known weight -- the exact pitfall the ADR names for
// the (still-empty) nutrition columns, and the ticket calls out by name for
// this function specifically.
export type MassResolution =
  | { status: "resolved"; grams: number }
  | { status: "unresolved" };

// searchIngredientLibrary's result (queries.ts): a user's own ingredient
// (already materialised in public.ingredients, ADR-0011 §2) or a
// library-only match that has no per-user row yet. The UI (#131) tells them
// apart via `source` to decide whether picking one needs createOwnIngredient
// first or can link ingredient_id directly.
export type IngredientSearchResult =
  | { source: "own"; ingredient: IngredientRow }
  | { source: "reference"; ingredient: ReferenceIngredientRow };

// Every write action (app/(app)/recepten/actions.ts) returns one of these
// instead of throwing or returning a bare string -- same shape and same
// reasoning as lib/boards/types.ts's ActionResult/BoardsErrorCode. This is a
// deliberately smaller, recipes-specific set: "column-mismatch" (boards) has
// no recipes equivalent in this ticket's scope (no cross-category move
// action exists yet), so it isn't copied over unused.
// "invalid-file-type"/"file-too-large"/"upload-failed" are #121's
// recipe thumbnail (R2) upload additions (lib/recipes/thumbnail-validation.ts /
// thumbnails.ts) -- kept in this shared union rather than a second
// thumbnail-specific ActionResult, same reasoning as the rest of this file.
// "invalid-image" is #174/#171's addition: unlike the other thumbnail
// errors above (all raised by the pre-decode gate in thumbnail-validation.
// ts), this one comes from lib/recipes/thumbnail-processing.ts's sharp
// pipeline rejecting bytes that passed mime/size validation but aren't a
// decodable image -- so it lives here next to `upload-failed` (also raised
// by thumbnails.ts, past the validation step) rather than in
// ThumbnailValidationError.
export type RecipesErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "generic"
  | "invalid-file-type"
  | "file-too-large"
  | "upload-failed"
  | "invalid-image"
  // #318: the 20-imports-per-hour limit (lib/recipes/import/rate-limit.ts).
  | "rate-limited"
  // #325 (ADR-0020 §6): non-admin caller of an ingredient-admin action; and a
  // shared alias key that already exists.
  | "forbidden"
  | "duplicate"
  // #326: a weight per unit already exists for this ingredient and unit (e.g. a NEVO row).
  | "unit-mass-exists";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: RecipesErrorCode };
