"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/recipes/session";
import { nextPosition } from "@/lib/boards/positioning";
import { searchIngredientLibrary } from "@/lib/recipes/queries";
import {
  uploadRecipeThumbnail as uploadRecipeThumbnailToStorage,
  deleteRecipeThumbnail,
} from "@/lib/recipes/thumbnails";
import {
  createCategorySchema,
  createOwnIngredientSchema,
  createRecipeSchema,
  deleteCategorySchema,
  deleteRecipeSchema,
  moveRecipeSchema,
  searchIngredientsSchema,
  updateCategorySchema,
  updateRecipeSchema,
} from "@/lib/recipes/schemas";
import type {
  ActionResult,
  IngredientRow,
  IngredientSearchResult,
  RecipeCategoryRow,
  RecipeRow,
} from "@/lib/recipes/types";
import type { Database } from "@/lib/database.types";

// Write side of #122 — category/recipe CRUD, called from the Recepten UI
// (later tickets). Every action follows lib/boards/'s
// app/(app)/te-doen/actions.ts pattern exactly:
//   1. parses its input with the matching lib/recipes/schemas.ts schema;
//   2. resolves the signed-in user and filters every query on that id
//      explicitly, on top of RLS (same "don't trust the client for
//      ownership" reasoning as #92 — see replaceRecipeContents below for
//      this ticket's version of that check);
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `recipes.errors.${error}` in the message catalog.
// revalidatePath("/recepten", "layout") runs on every successful
// category/recipe write except moveRecipe: the category board and
// /recepten/[recipeId] both read through this layout, and the "layout" type
// argument (#169) is required for a bare "/recepten" call to also match that
// dynamic child segment — Next.js only does exact-path matching without it,
// so /recepten/[recipeId] previously got no server refresh from these
// actions at all. moveRecipe has no revalidatePath call, mirroring
// te-doen/actions.ts's moveCard (see that file's header comment for the
// full "the client already updates optimistically, don't bundle an RSC
// re-render onto the drag response" reasoning, #169).
//
// Location (ticket decision c): app/(app)/recepten/actions.ts, colocated
// with the route exactly like app/(app)/te-doen/actions.ts — the ticket
// asked for this by analogy and no reason surfaced during this ticket to
// deviate (recipes has no cross-cutting concern boards doesn't).
//
// Ingredients/steps write strategy (ticket decision a, #122; upgraded #149):
// replace-in-transaction, not per-row diff. #126's add-recipe form always
// sends a recipe's full ingredient/step set in one call (no per-row
// endpoints exist yet), so per-row diffing would be built for a write shape
// nothing calls. "In transaction" used to be an intent, not a fact:
// supabase-js only reaches a real Postgres transaction via an RPC function,
// and #122's stated file list didn't include one, so the old
// replaceRecipeIngredients/replaceRecipeSteps did delete-then-insert as two
// sequential statements. #149 closes that gap: the user
// (2026-08-01) approved this repo's first RPC,
// public.replace_recipe_contents (20260802000001_recipe_step_ingredients.sql),
// and replaceRecipeContents below is one supabase.rpc(...) call — the
// delete-then-insert across recipe_ingredients/recipe_steps/
// recipe_step_ingredients now runs inside one real Postgres transaction, not
// two round trips. createRecipe still compensates a failed contents write by
// deleting the just-created recipe (the RPC call can still fail before ever
// running, e.g. a network error, leaving an empty recipe behind). updateRecipe
// needs no equivalent compensation: the "successful delete then failing
// insert" data-loss window this file used to have between the two statements
// is closed by the RPC's transaction — either the whole replace lands, or
// none of it does.

type Client = SupabaseClient<Database>;
type IngredientLine = z.infer<typeof createRecipeSchema>["ingredients"][number];
type StepLine = z.infer<typeof createRecipeSchema>["steps"][number];

// requireUserId used to be defined locally here (identically in
// app/(app)/te-doen/actions.ts and app/(app)/winkelmand/actions.ts) taking a
// `supabase` client argument. #168 replaced all three copies with the
// shared, cache()'d, argument-free lib/boards/session.ts helper (re-exported
// via lib/recipes/session.ts) -- see that file's header comment.

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[recipes] ${action} failed:`, error.code, error.message);
}

// Position of the last row (by `position`) owned by `userId` — the shared
// "append at the end" building block for createCategory, same shape as
// lib/boards' lastBoardPosition/lastColumnPosition/lastCardPosition.
async function lastCategoryPosition(supabase: Client, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("recipe_categories")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

// Position of the last recipe (by `position`) owned by `userId` within one
// category -- the #155 analogue of lastCategoryPosition above, and of
// lib/boards' lastCardPosition (recipe_categories : recipes :: board_columns
// : cards). Used to append a newly created recipe, or a recipe whose
// category just changed, at the end of its (new) category rather than at an
// arbitrary position.
async function lastRecipePosition(
  supabase: Client,
  userId: string,
  categoryId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("recipes")
    .select("position")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

// Replaces every recipe_ingredients/recipe_steps/recipe_step_ingredients row
// for `recipeId` with `ingredients`/`steps`, via one call to the
// public.replace_recipe_contents RPC (#149, see the module header comment)
// — a real Postgres transaction, not the old two-statement delete-then-
// insert pairs. Still rejects the whole write from this layer (returns
// `{ ok: false }`, the RPC is never called, nothing is touched) if any
// line's ingredientId doesn't belong to this user — the same "don't trust
// the client for ownership" check moveCard applies to columnId, applied
// here to recipe_ingredients.ingredient_id. This check stays in this file
// rather than folding into the RPC because it's a cross-table check against
// public.ingredients, unrelated to the RPC's own recipe-ownership guard.
async function replaceRecipeContents(
  supabase: Client,
  userId: string,
  recipeId: string,
  ingredients: IngredientLine[],
  steps: StepLine[],
): Promise<{ ok: true } | { ok: false }> {
  const ingredientIds = [
    ...new Set(
      ingredients
        .map((line) => line.ingredientId)
        .filter((id): id is string => id != null),
    ),
  ];
  if (ingredientIds.length > 0) {
    const { data: owned, error: ownedError } = await supabase
      .from("ingredients")
      .select("id")
      .eq("user_id", userId)
      .in("id", ingredientIds);
    if (ownedError) {
      logDbError("replaceRecipeContents/ownership-check", ownedError);
      return { ok: false };
    }
    if ((owned?.length ?? 0) !== ingredientIds.length) return { ok: false };
  }

  const { error } = await supabase.rpc("replace_recipe_contents", {
    p_recipe_id: recipeId,
    p_ingredients: ingredients.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      ingredientId: line.ingredientId ?? null,
      groupLabel: line.groupLabel ?? null,
      needsReview: line.needsReview ?? false,
    })),
    p_steps: steps.map((line) => ({
      instruction: line.instruction,
      ingredientRefs: line.ingredientRefs,
    })),
  });
  if (error) {
    logDbError("replaceRecipeContents", error);
    return { ok: false };
  }
  return { ok: true };
}

// ============================================================================
// Categories
// ============================================================================

export async function createCategory(
  input: unknown,
): Promise<ActionResult<RecipeCategoryRow>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const last = await lastCategoryPosition(supabase, auth.userId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("recipe_categories")
    .insert({
      user_id: auth.userId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createCategory", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/recepten", "layout");
  return { success: true, data };
}

// Rename -> update (#149's category-icon bug): the panel always sends the
// selected icon alongside the name, and this action now writes both — the
// old renameCategory only ever wrote `name`, which is why picking a
// different icon and saving silently did nothing.
export async function updateCategory(input: unknown): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("recipe_categories")
    .update({ name: parsed.data.name, icon: parsed.data.icon })
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("updateCategory", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/recepten", "layout");
  return { success: true, data: undefined };
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  // recipes.category_id is `on delete cascade` (20260730000002_recipe_schema.sql):
  // deleting a category deletes its recipes, which in turn cascade-deletes
  // their ingredients/steps. No manual cleanup needed here.
  const { data, error } = await supabase
    .from("recipe_categories")
    .delete()
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteCategory", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/recepten", "layout");
  return { success: true, data: undefined };
}

// ============================================================================
// Recipes
// ============================================================================

export async function createRecipe(input: unknown): Promise<ActionResult<RecipeRow>> {
  const parsed = createRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: category, error: categoryError } = await supabase
    .from("recipe_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (categoryError) {
    logDbError("createRecipe/category-lookup", categoryError);
    return { success: false, error: "generic" };
  }
  if (!category) return { success: false, error: "not-found" };

  // #155: append at the end of the target category, same
  // last-position-then-nextPosition(last, null) shape as createCategory/
  // createBoard/createColumn/createCard.
  const last = await lastRecipePosition(supabase, auth.userId, parsed.data.categoryId);
  const position = nextPosition(last, null);

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      user_id: auth.userId,
      category_id: parsed.data.categoryId,
      title: parsed.data.title,
      servings: parsed.data.servings,
      thumbnail_path: parsed.data.thumbnailPath ?? null,
      time_minutes: parsed.data.timeMinutes ?? null,
      position,
    })
    .select()
    .single();
  if (recipeError || !recipe) {
    if (recipeError) logDbError("createRecipe", recipeError);
    return { success: false, error: "generic" };
  }

  const contentsResult = await replaceRecipeContents(
    supabase,
    auth.userId,
    recipe.id,
    parsed.data.ingredients,
    parsed.data.steps,
  );

  if (!contentsResult.ok) {
    // See the module header comment (decision a): compensate rather than
    // leave a recipe with no ingredients/steps behind.
    const { error: cleanupError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipe.id)
      .eq("user_id", auth.userId);
    if (cleanupError) logDbError("createRecipe/cleanup", cleanupError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/recepten", "layout");
  return { success: true, data: recipe };
}

export async function updateRecipe(input: unknown): Promise<ActionResult> {
  const parsed = updateRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const { recipeId, ingredients, steps, ...fields } = parsed.data;

  // Only fields the caller actually sent get written, same reasoning as
  // te-doen/actions.ts's updateCard.
  const update: Database["public"]["Tables"]["recipes"]["Update"] = {};
  if (fields.categoryId !== undefined) update.category_id = fields.categoryId;
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.servings !== undefined) update.servings = fields.servings;
  if (fields.thumbnailPath !== undefined) update.thumbnail_path = fields.thumbnailPath;
  if (fields.timeMinutes !== undefined) update.time_minutes = fields.timeMinutes;

  if (Object.keys(update).length === 0 && ingredients === undefined && steps === undefined) {
    return { success: false, error: "invalid-input" };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: existing, error: existingError } = await supabase
    .from("recipes")
    // #155: `category_id` too — the re-position below must fire on a real
    // category *change*, not merely on the field being present in the
    // payload (RecipePanel always sends it, even when untouched).
    .select("id, category_id")
    .eq("id", recipeId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (existingError) {
    logDbError("updateRecipe/lookup", existingError);
    return { success: false, error: "generic" };
  }
  if (!existing) return { success: false, error: "not-found" };

  if (update.category_id !== undefined) {
    const { data: category, error: categoryError } = await supabase
      .from("recipe_categories")
      .select("id")
      .eq("id", update.category_id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (categoryError) {
      logDbError("updateRecipe/category-lookup", categoryError);
      return { success: false, error: "generic" };
    }
    if (!category) return { success: false, error: "not-found" };

    // #155: a recipe moved to a different category via the edit panel (not
    // drag & drop) has no drop index to derive a position from -- land it
    // at the end of its new category, same "append" shape createRecipe
    // uses, rather than keeping whatever `position` it happened to hold in
    // its old category (which would place it at an arbitrary spot among the
    // new category's siblings). Only on a real change: RecipePanel sends
    // `categoryId` on every save, so re-positioning whenever the field is
    // merely present would drop a recipe to the bottom of its column every
    // time the user edited its title -- silently undoing a drag.
    if (update.category_id !== existing.category_id) {
      const last = await lastRecipePosition(supabase, auth.userId, update.category_id);
      update.position = nextPosition(last, null);
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase
      .from("recipes")
      .update(update)
      .eq("id", recipeId)
      .eq("user_id", auth.userId);
    if (updateError) {
      logDbError("updateRecipe", updateError);
      return { success: false, error: "generic" };
    }
  }

  // updateRecipeSchema's superRefine enforces both-or-neither, so `ingredients`
  // and `steps` are always defined together here (see schemas.ts's comment) —
  // one replaceRecipeContents call, one RPC transaction, no partial-write
  // window left between them (module header comment).
  if (ingredients !== undefined && steps !== undefined) {
    const result = await replaceRecipeContents(supabase, auth.userId, recipeId, ingredients, steps);
    if (!result.ok) return { success: false, error: "generic" };
  }

  revalidatePath("/recepten", "layout");
  return { success: true, data: undefined };
}

export async function deleteRecipe(input: unknown): Promise<ActionResult> {
  const parsed = deleteRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  // #149: read thumbnail_path before deleting the row, so a stored
  // recipe-thumbnails object doesn't outlive the recipe it belonged to. Not
  // fatal if this lookup comes back empty/errored — the delete below still
  // runs and reports its own not-found/generic error the normal way.
  const { data: existing, error: existingError } = await supabase
    .from("recipes")
    .select("thumbnail_path")
    .eq("id", parsed.data.recipeId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (existingError) logDbError("deleteRecipe/lookup", existingError);

  // recipe_ingredients/recipe_steps are `on delete cascade` from recipes.id
  // (20260730000002_recipe_schema.sql); recipe_step_ingredients cascades a
  // further step from recipe_steps (#149) — no manual cleanup needed here.
  const { data, error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", parsed.data.recipeId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteRecipe", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  // Best-effort, after the row is confirmed gone: a failed storage removal
  // must never fail the recipe delete (the row is already gone either way)
  // — deleteRecipeThumbnail itself logs and swallows its own errors.
  if (existing?.thumbnail_path) {
    await deleteRecipeThumbnail(existing.thumbnail_path);
  }

  revalidatePath("/recepten", "layout");
  return { success: true, data: undefined };
}

// #155/#169: drag & drop persistence, modelled directly on
// te-doen/actions.ts's moveCard -- same "one RPC round trip" shape
// (20260810000002_move_rpcs.sql's public.move_recipe mirrors move_card's
// ownership guard + neighbor-midpoint computation, ported from
// lib/boards/positioning.ts's nextPosition). One real difference from
// moveCard, unchanged by #169: recipe_categories have no parent entity the
// way board_columns has boards, so there is no "column-mismatch" case (a
// category is never on anything but this user's account) -- move_recipe's
// own ownership guard on both the recipe and the target category is already
// the complete version of that check, where move_card needs a second lookup
// (the column's board_id) to get the same guarantee. No revalidatePath call
// here, same reasoning as moveCard (see this file's header comment).
export async function moveRecipe(
  input: unknown,
): Promise<ActionResult<{ position: number }>> {
  const parsed = moveRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const { recipeId, categoryId, targetIndex } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: position, error } = await supabase.rpc("move_recipe", {
    p_recipe_id: recipeId,
    p_category_id: categoryId,
    p_target_index: targetIndex,
  });

  if (error) {
    logDbError("moveRecipe", error);
    // MV404 = recipe or target category not found/not owned by this user
    // (see the migration) -- move_recipe never raises MV409, it has no
    // column-mismatch equivalent (comment above). Anything else -- including
    // the ported InvalidNeighborOrderError case -- falls back to "generic".
    if (error.code === "MV404") return { success: false, error: "not-found" };
    return { success: false, error: "generic" };
  }
  if (position === null) return { success: false, error: "generic" };

  return { success: true, data: { position } };
}

// ============================================================================
// ADR-0011 ingredient library: create-own / materialise-a-library-pick
// ============================================================================

/**
 * Creates a `public.ingredients` row for the signed-in user (ADR-0011 §2).
 * `referenceId: null` is the ticket's explicit "search yielded nothing, add
 * as new" case; a set `referenceId` is the companion case the ADR names in
 * the same breath — "picking a library ingredient materialises (or reuses)
 * a user-owned row that links to the reference row" — reusing an existing
 * row for that reference_id instead of inserting a duplicate. One function
 * covers both, matching the ticket's own dependency note that #131 "calls
 * the search function and the create function above" (singular).
 */
export async function createOwnIngredient(
  input: unknown,
): Promise<ActionResult<IngredientRow>> {
  const parsed = createOwnIngredientSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  if (parsed.data.referenceId) {
    const { data: existing, error: existingError } = await supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("reference_id", parsed.data.referenceId)
      .maybeSingle();
    if (existingError) {
      logDbError("createOwnIngredient/existing-lookup", existingError);
      return { success: false, error: "generic" };
    }
    if (existing) return { success: true, data: existing };
  }

  const { data, error } = await supabase
    .from("ingredients")
    .insert({
      user_id: auth.userId,
      reference_id: parsed.data.referenceId,
      name: parsed.data.name,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createOwnIngredient", error);
    return { success: false, error: "generic" };
  }

  // No revalidatePath: this manages the ingredient library, not the
  // /recepten route — it's called from within the recipe write flow
  // (#126/#131), whose own actions already revalidate it.
  return { success: true, data };
}

/**
 * Thin `"use server"` wrapper around `searchIngredientLibrary`
 * (queries.ts) — not a second implementation. `queries.ts` is guarded by
 * `import "server-only"`, which only blocks it from being *bundled* into
 * client code; it isn't itself an RPC boundary, so `IngredientSearchPanel`
 * (a Client Component, #131) cannot call it directly and needs a real
 * server action reference to pass down as a prop (same "props in, callback
 * out" shape `CardDetailPanel.tsx` uses for its mutations). Input is parsed
 * like every other action here rather than trusted from the TS call site,
 * because a Server Action is a real network endpoint regardless of how it's
 * invoked from the client bundle.
 */
export async function searchIngredients(input: unknown): Promise<IngredientSearchResult[]> {
  const parsed = searchIngredientsSchema.safeParse(input);
  if (!parsed.success) return [];
  return searchIngredientLibrary(parsed.data.query);
}

// ============================================================================
// #121: recipe-thumbnails upload
// ============================================================================

/**
 * Thin `"use server"` wrapper around lib/recipes/thumbnails.ts's
 * uploadRecipeThumbnail -- same "Client Component needs a real action
 * reference" reasoning as searchIngredients above. `formData` (not a bare
 * `File`) because a Server Action's client-callable signature must be a
 * serialisable/FormData shape; the field is read here rather than trusted
 * as already-a-File.
 */
export async function uploadRecipeThumbnail(
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) return { success: false, error: "invalid-input" };
  return uploadRecipeThumbnailToStorage(file);
}
