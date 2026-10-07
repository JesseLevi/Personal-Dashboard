import { z } from "zod";
import { isUnitCode } from "@/lib/recipes/units";
import { importUrlSchema } from "@/lib/recipes/import/url";

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
  // #312: import flags a line the parser/matcher was unsure about; omitted
  // (manual edits) means false.
  needsReview: z.boolean().optional(),
});

const recipeStepLine = z.object({
  instruction: z.string().trim().min(1).max(5000),
  // 0-based indexes into the same call's `ingredients` array (#149) — which
  // of this step's own recipe's ingredient lines render as Tags under it
  // (Figma node 3749:3091 picker / 3778:5467 detail rendering). Range-checked
  // against `ingredients.length` in createRecipeSchema/updateRecipeSchema's
  // superRefine below, not here — a single step line has no visibility into
  // the full ingredients array on its own.
  ingredientRefs: z.array(z.int().nonnegative()).default([]),
});

// Shared by createRecipeSchema/updateRecipeSchema's superRefine below —
// rejects any step's ingredientRefs index that is out of range for the
// ingredients array in the same payload, since the RPC (#149,
// public.replace_recipe_contents) silently skips an out-of-range index
// rather than raising, and a bad index reaching that far is more useful
// caught here as a normal validation error than swallowed in the database.
function validateIngredientRefs(
  ingredients: ReadonlyArray<unknown> | undefined,
  steps: ReadonlyArray<{ ingredientRefs: number[] }> | undefined,
  ctx: z.RefinementCtx,
) {
  const ingredientCount = ingredients?.length ?? 0;
  steps?.forEach((step, stepIndex) => {
    step.ingredientRefs.forEach((ref, refIndex) => {
      if (ref >= ingredientCount) {
        ctx.addIssue({
          code: "custom",
          message: `ingredientRefs[${refIndex}] (${ref}) is out of range for ${ingredientCount} ingredient(s)`,
          path: ["steps", stepIndex, "ingredientRefs", refIndex],
        });
      }
    });
  });
}

export const createCategorySchema = z.object({
  name,
  icon,
});

// Rename -> update (#149's category-icon bug, see actions.ts): the panel
// always knows the selected icon and must resend it, not just `name` — the
// old renameCategorySchema/renameCategory only ever wrote `name`, which is
// why picking a different icon and saving silently did nothing.
export const updateCategorySchema = z.object({
  categoryId: z.uuid(),
  name,
  icon,
});

export const deleteCategorySchema = z.object({
  categoryId: z.uuid(),
});

// Ingredients/steps arrive as the recipe's full ordered set in one call
// (#126's add-recipe form, see lib/recipes/queries.ts / actions.ts header
// comments on the replace-in-transaction decision) -- not one schema per
// row. `.default([])` lets a recipe be created with no lines yet.
export const createRecipeSchema = z
  .object({
    categoryId: z.uuid(),
    title,
    servings: z.int().positive().optional(),
    thumbnailPath: z.string().trim().min(1).max(500).nullable().optional(),
    timeMinutes: z.int().positive().nullable().optional(),
    ingredients: z.array(recipeIngredientLine).default([]),
    steps: z.array(recipeStepLine).default([]),
  })
  .superRefine((data, ctx) => validateIngredientRefs(data.ingredients, data.steps, ctx));

// Every field but recipeId is optional and independently omittable: a
// metadata-only edit (e.g. rename) must not be forced to resend the full
// ingredients/steps sets. `ingredients`/`steps` themselves are the exception
// -- when present at all they always mean "replace the full set with this
// one" (see actions.ts), never a partial patch of individual lines.
//
// Both-or-neither (#149): the write path is now one RPC call
// (public.replace_recipe_contents) that replaces recipe_ingredients AND
// recipe_steps together in a single transaction -- there is no server
// operation left that can apply just one half of that pair, so a client
// sending `steps` without `ingredients` (or vice versa) can never be
// satisfied correctly and is rejected here rather than silently replacing
// one set against a database-side array it never saw.
export const updateRecipeSchema = z
  .object({
    recipeId: z.uuid(),
    categoryId: z.uuid().optional(),
    title: title.optional(),
    servings: z.int().positive().optional(),
    thumbnailPath: z.string().trim().min(1).max(500).nullable().optional(),
    timeMinutes: z.int().positive().nullable().optional(),
    ingredients: z.array(recipeIngredientLine).optional(),
    steps: z.array(recipeStepLine).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.ingredients === undefined) !== (data.steps === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "ingredients and steps must be sent together, or neither",
        path: ["steps"],
      });
      return;
    }
    validateIngredientRefs(data.ingredients, data.steps, ctx);
  });

export const deleteRecipeSchema = z.object({
  recipeId: z.uuid(),
});

// #155 drag & drop -- same "index, not a raw position" shape and the same
// reason for it as lib/boards/schemas.ts's moveCardSchema (a client can
// influence where a recipe lands but never inject an arbitrary position
// number for it); see that schema's own comment rather than repeating it
// here.
export const moveRecipeSchema = z.object({
  recipeId: z.uuid(),
  categoryId: z.uuid(),
  targetIndex: z.int().nonnegative(),
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

// #316: the user fixed a needs_review import line by picking one of their own
// ingredients. The alias key comes from the stored recipe_ingredients.name
// server-side, never from the client.
export const confirmIngredientMatchSchema = z.object({
  recipeIngredientId: z.uuid(),
  ingredientId: z.uuid(),
});

// #318: "Via link". The URL is also re-validated by safe-fetch (#313).
export const startRecipeImportSchema = z.object({
  categoryId: z.uuid(),
  url: importUrlSchema,
});

export const retryRecipeImportSchema = z.object({
  recipeId: z.uuid(),
});
