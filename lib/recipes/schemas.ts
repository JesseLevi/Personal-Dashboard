import { z } from "zod";
import { isUnitCode } from "@/lib/recipes/units";

// Validates every server-action input in app/(app)/recepten/actions.ts
// (#122), same pattern and same split (shape/format here, ownership checked
// separately against the database) as lib/boards/schemas.ts.

const name = z.string().trim().min(1).max(200);
const title = z.string().trim().min(1).max(200);
// recipe_categories.icon: free-text column, validated against the IconName
// union at render time (components/atoms/Icon.tsx) -- same convention as
// lib/boards/schemas.ts's `icon` for board_columns.icon.
const icon = z.string().trim().min(1).max(100);

// recipe_ingredients.unit is a real Postgres enum (public.recipe_unit,
// #130), and its one canonical, tripwire-tested source of truth is
// lib/recipes/units.ts's UNIT_CODES/isUnitCode (#120) -- validating against
// a second, hand-copied z.enum(...) list here would be exactly the drift
// #120's enum-sync test exists to catch. `.refine` with isUnitCode's type
// predicate narrows the parsed output to UnitCode, not a bare string.
const unit = z.string().refine(isUnitCode, { message: "Invalid unit code" });

// quantity: nullable per the ticket ("naar smaak" rows have no number) --
// also positive when present, mirroring recipe_ingredients' own
// `check (quantity is null or quantity > 0)` (20260730000002_recipe_schema.sql)
// so a bad value comes back as this module's "invalid-input" instead of a
// raw database constraint error reaching the action layer.
const quantity = z.number().positive().nullable();

const recipeIngredientLine = z.object({
  name,
  quantity,
  unit,
  // Nullable enrichment FK into public.ingredients (ADR-0011 §2) -- never a
  // precondition for the line to save, see recipe_ingredients.ingredient_id's
  // migration comment.
  ingredientId: z.uuid().nullable().optional(),
  groupLabel: z.string().trim().min(1).max(100).nullable().optional(),
});

const recipeStepLine = z.object({
  instruction: z.string().trim().min(1).max(5000),
});

export const createCategorySchema = z.object({
  name,
  icon,
});

export const renameCategorySchema = z.object({
  categoryId: z.uuid(),
  name,
});

export const deleteCategorySchema = z.object({
  categoryId: z.uuid(),
});

// Ingredients/steps arrive as the recipe's full ordered set in one call
// (#126's add-recipe form, see lib/recipes/queries.ts / actions.ts header
// comments on the replace-in-transaction decision) -- not one schema per
// row. `.default([])` lets a recipe be created with no lines yet.
export const createRecipeSchema = z.object({
  categoryId: z.uuid(),
  title,
  servings: z.int().positive().optional(),
  thumbnailPath: z.string().trim().min(1).max(500).nullable().optional(),
  timeMinutes: z.int().positive().nullable().optional(),
  ingredients: z.array(recipeIngredientLine).default([]),
  steps: z.array(recipeStepLine).default([]),
});

// Every field but recipeId is optional and independently omittable: a
// metadata-only edit (e.g. rename) must not be forced to resend the full
// ingredients/steps sets. `ingredients`/`steps` themselves are the exception
// -- when present at all they always mean "replace the full set with this
// one" (see actions.ts), never a partial patch of individual lines.
export const updateRecipeSchema = z.object({
  recipeId: z.uuid(),
  categoryId: z.uuid().optional(),
  title: title.optional(),
  servings: z.int().positive().optional(),
  thumbnailPath: z.string().trim().min(1).max(500).nullable().optional(),
  timeMinutes: z.int().positive().nullable().optional(),
  ingredients: z.array(recipeIngredientLine).optional(),
  steps: z.array(recipeStepLine).optional(),
});

export const deleteRecipeSchema = z.object({
  recipeId: z.uuid(),
});

// ADR-0011 §2's "add as new ingredient" / "materialise a picked library
// ingredient" action (lib/recipes/queries.ts header comment explains why one
// function covers both). referenceId null = self-added, unlinked ingredient;
// referenceId set = pick from reference.ingredients, reusing an existing
// per-user row for that reference_id if one already exists.
export const createOwnIngredientSchema = z.object({
  name,
  referenceId: z.uuid().nullable(),
});

// #131's IngredientSearchPanel search box. searchIngredientLibrary
// (queries.ts) itself trims/empty-guards `query`, so this only bounds length
// against a pathological payload -- an empty string is valid input (the
// panel's own "not yet searched" state never calls this action at all, but
// the server-side boundary shouldn't rely on that client behaviour).
export const searchIngredientsSchema = z.object({
  query: z.string().max(200),
});
