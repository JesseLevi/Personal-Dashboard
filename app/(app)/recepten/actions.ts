"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { nextPosition } from "@/lib/boards/positioning";
import {
  createCategorySchema,
  createOwnIngredientSchema,
  createRecipeSchema,
  deleteCategorySchema,
  deleteRecipeSchema,
  renameCategorySchema,
  updateRecipeSchema,
} from "@/lib/recipes/schemas";
import type {
  ActionResult,
  IngredientRow,
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
//      ownership" reasoning as #92 — see replaceRecipeIngredients below for
//      this ticket's version of that check);
//   3. returns a typed ActionResult instead of throwing, so the UI can look
//      up `recipes.errors.${error}` in the message catalog.
// revalidatePath("/recepten") runs on every successful category/recipe
// write, mirroring te-doen's single-route revalidation (no per-category
// route segment exists yet).
//
// Location (ticket decision c): app/(app)/recepten/actions.ts, colocated
// with the route exactly like app/(app)/te-doen/actions.ts — the ticket
// asked for this by analogy and no reason surfaced during this ticket to
// deviate (recipes has no cross-cutting concern boards doesn't).
//
// Ingredients/steps write strategy (ticket decision a): replace-in-
// transaction, not per-row diff. #126's add-recipe form always sends a
// recipe's full ingredient/step set in one call (no per-row endpoints exist
// yet — the ticket itself flags a standalone "delete this row" endpoint as
// still open, see #122's body), so per-row diffing would be built for a
// write shape nothing calls. "In transaction" is the ideal — a real single
// Postgres transaction — but supabase-js only reaches that via an RPC
// function, and no migration is in this ticket's stated file list to add
// one. replaceRecipeIngredients/replaceRecipeSteps below therefore do
// delete-then-insert as two sequential statements (same accepted trade-off
// this codebase already ships in toggleBoardFavorite's clear-then-set), and
// createRecipe compensates a failed ingredients/steps write by deleting the
// just-created recipe rather than leaving an empty one behind. A real RPC
// transaction is the natural follow-up if this window ever proves to matter
// in practice.

type Client = SupabaseClient<Database>;
type IngredientLine = z.infer<typeof createRecipeSchema>["ingredients"][number];
type StepLine = z.infer<typeof createRecipeSchema>["steps"][number];

async function requireUserId(
  supabase: Client,
): Promise<{ userId: string } | { error: "unauthenticated" }> {
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { error: "unauthenticated" };
  return { userId };
}

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

// Replaces every recipe_ingredients row for `recipeId` with `lines`, in
// submitted order (position = (index+1)*1000, same spacing convention as
// lib/boards/defaults.ts's DEFAULT_BOARD_COLUMNS — a direct index-based
// scheme rather than repeated nextPosition() calls, since the whole set
// arrives at once rather than one row being inserted into an existing
// order). Rejects the whole write (returns `{ ok: false }`, nothing is
// deleted) if any line's ingredientId doesn't belong to this user — the
// same "don't trust the client for ownership" check moveCard applies to
// columnId, applied here to recipe_ingredients.ingredient_id.
async function replaceRecipeIngredients(
  supabase: Client,
  userId: string,
  recipeId: string,
  lines: IngredientLine[],
): Promise<{ ok: true } | { ok: false }> {
  const ingredientIds = [
    ...new Set(
      lines
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
      logDbError("replaceRecipeIngredients/ownership-check", ownedError);
      return { ok: false };
    }
    if ((owned?.length ?? 0) !== ingredientIds.length) return { ok: false };
  }

  const { error: deleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("user_id", userId);
  if (deleteError) {
    logDbError("replaceRecipeIngredients/delete", deleteError);
    return { ok: false };
  }
  if (lines.length === 0) return { ok: true };

  const { error: insertError } = await supabase.from("recipe_ingredients").insert(
    lines.map((line, index) => ({
      user_id: userId,
      recipe_id: recipeId,
      ingredient_id: line.ingredientId ?? null,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      position: (index + 1) * 1000,
      group_label: line.groupLabel ?? null,
    })),
  );
  if (insertError) {
    logDbError("replaceRecipeIngredients/insert", insertError);
    return { ok: false };
  }
  return { ok: true };
}

// Same replace strategy as replaceRecipeIngredients above, for recipe_steps
// — no ownership-of-a-linked-id check needed here, steps carry no FK besides
// recipe_id (already resolved and checked by the caller).
async function replaceRecipeSteps(
  supabase: Client,
  userId: string,
  recipeId: string,
  lines: StepLine[],
): Promise<{ ok: true } | { ok: false }> {
  const { error: deleteError } = await supabase
    .from("recipe_steps")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("user_id", userId);
  if (deleteError) {
    logDbError("replaceRecipeSteps/delete", deleteError);
    return { ok: false };
  }
  if (lines.length === 0) return { ok: true };

  const { error: insertError } = await supabase.from("recipe_steps").insert(
    lines.map((line, index) => ({
      user_id: userId,
      recipe_id: recipeId,
      position: (index + 1) * 1000,
      instruction: line.instruction,
    })),
  );
  if (insertError) {
    logDbError("replaceRecipeSteps/insert", insertError);
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
  const auth = await requireUserId(supabase);
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

  revalidatePath("/recepten");
  return { success: true, data };
}

export async function renameCategory(input: unknown): Promise<ActionResult> {
  const parsed = renameCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("recipe_categories")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.categoryId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameCategory", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/recepten");
  return { success: true, data: undefined };
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
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

  revalidatePath("/recepten");
  return { success: true, data: undefined };
}

// ============================================================================
// Recipes
// ============================================================================

export async function createRecipe(input: unknown): Promise<ActionResult<RecipeRow>> {
  const parsed = createRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
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

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      user_id: auth.userId,
      category_id: parsed.data.categoryId,
      title: parsed.data.title,
      servings: parsed.data.servings,
      thumbnail_path: parsed.data.thumbnailPath ?? null,
      time_minutes: parsed.data.timeMinutes ?? null,
    })
    .select()
    .single();
  if (recipeError || !recipe) {
    if (recipeError) logDbError("createRecipe", recipeError);
    return { success: false, error: "generic" };
  }

  const ingredientsResult = await replaceRecipeIngredients(
    supabase,
    auth.userId,
    recipe.id,
    parsed.data.ingredients,
  );
  const stepsResult = ingredientsResult.ok
    ? await replaceRecipeSteps(supabase, auth.userId, recipe.id, parsed.data.steps)
    : ({ ok: false } as const);

  if (!ingredientsResult.ok || !stepsResult.ok) {
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

  revalidatePath("/recepten");
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
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: existing, error: existingError } = await supabase
    .from("recipes")
    .select("id")
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

  if (ingredients !== undefined) {
    const result = await replaceRecipeIngredients(supabase, auth.userId, recipeId, ingredients);
    if (!result.ok) return { success: false, error: "generic" };
  }
  if (steps !== undefined) {
    const result = await replaceRecipeSteps(supabase, auth.userId, recipeId, steps);
    if (!result.ok) return { success: false, error: "generic" };
  }

  revalidatePath("/recepten");
  return { success: true, data: undefined };
}

export async function deleteRecipe(input: unknown): Promise<ActionResult> {
  const parsed = deleteRecipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  // recipe_ingredients/recipe_steps are `on delete cascade` from recipes.id
  // (20260730000002_recipe_schema.sql) — no manual cleanup needed here.
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

  revalidatePath("/recepten");
  return { success: true, data: undefined };
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
  const auth = await requireUserId(supabase);
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
