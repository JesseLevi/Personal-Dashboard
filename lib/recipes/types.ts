import type { Database } from "@/lib/database.types";

// Read-side shapes returned by lib/recipes/queries.ts, plus the write-side
// ActionResult/RecipesErrorCode contract for app/(app)/recepten/actions.ts
// -- same split as lib/boards/types.ts (#92).

export type RecipeCategoryRow = Database["public"]["Tables"]["recipe_categories"]["Row"];
export type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type RecipeStepRow = Database["public"]["Tables"]["recipe_steps"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];
export type RecipeTagRow = Database["public"]["Tables"]["recipe_tags"]["Row"];

// ADR-0011's two-layer ingredient library. IngredientRow is the per-user
// public.ingredients row every recipe_ingredients.ingredient_id FK actually
// points at; ReferenceIngredientRow is the shared, read-only
// reference.ingredients row it may optionally link to.
export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];
export type ReferenceIngredientRow = Database["reference"]["Tables"]["ingredients"]["Row"];

export type RecipeWithIngredientsAndSteps = RecipeRow & {
  ingredients: RecipeIngredientRow[];
  steps: RecipeStepRow[];
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
export type RecipesErrorCode =
  | "invalid-input"
  | "unauthenticated"
  | "not-found"
  | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: RecipesErrorCode };
