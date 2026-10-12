"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/recipes/session";
import { nextPosition } from "@/lib/boards/positioning";
import { getRecipeWithIngredientsAndSteps } from "@/lib/recipes/queries";
import { getDefaultShoppingListId } from "@/lib/shopping/lists";
import { buildShoppingListLines, mergeSingleIngredientLine } from "@/lib/shopping/send-to-list";
import {
  addIngredientToShoppingListSchema,
  addShoppingListItemSchema,
  clearShoppingListSchema,
  createShoppingListSchema,
  deleteShoppingListItemSchema,
  deleteShoppingListSchema,
  renameShoppingListSchema,
  sendRecipeToShoppingListSchema,
  toggleShoppingListItemSchema,
} from "@/lib/shopping/schemas";
import type { ActionResult, ShoppingListItemRow, ShoppingListRow } from "@/lib/shopping/types";
import { inviteMember, revokeShare, searchMembers } from "@/lib/sharing/actions";
import type { Database } from "@/lib/database.types";

// Write side of #176 -- Winkelmand item CRUD, called from the Winkelmand UI
// (later ticket). Follows app/(app)/recepten/actions.ts's pattern exactly:
//   1. parses its input with the matching lib/shopping/schemas.ts schema
//      (every action takes a single `input: unknown`, even the ones the
//      ticket describes with positional args, because a Server Action is a
//      real network endpoint regardless of how it's invoked from the client
//      bundle -- see app/(app)/recepten/actions.ts's searchIngredients
//      comment for the same reasoning);
//   2. works per basket (`listId`, default: the user's default basket,
//      ADR-0035) and lets RLS decide access -- no user_id filter on items,
//      never service_role;
//   3. returns a typed ActionResult instead of throwing.
// revalidatePath("/winkelmand", "layout") runs on every successful write: the
// "layout" argument is what also matches the dynamic /winkelmand/[listId] child.

type Client = SupabaseClient<Database>;

// requireUserId used to be defined locally here (identically in
// app/(app)/te-doen/actions.ts and app/(app)/recepten/actions.ts) taking a
// `supabase` client argument. #168 replaced all three copies with the
// shared, cache()'d, argument-free lib/boards/session.ts helper (re-exported
// via lib/recipes/session.ts) -- see that file's header comment.

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[shopping] ${action} failed:`, error.code, error.message);
}

// Resolves the basket an action works on: the caller's `listId`, or the
// signed-in user's default basket. RLS decides whether the list is usable.
async function resolveListId(
  supabase: Client,
  userId: string,
  listId: string | undefined,
): Promise<string | null> {
  return listId ?? (await getDefaultShoppingListId(supabase, userId));
}

// Position of the last row (by `position`) in a basket -- the same "append at
// the end" building block as lib/recipes/'s lastCategoryPosition.
async function lastShoppingListItemPosition(
  supabase: Client,
  listId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("shopping_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

/**
 * Appends a new item at the end of the signed-in user's shopping list:
 * `position` = last existing position + 1000, seeding 1000 for an empty
 * list -- exactly what `nextPosition(last, null)` already computes
 * (lib/boards/positioning.ts), reused rather than re-implemented.
 */
export async function addShoppingListItem(
  input: unknown,
): Promise<ActionResult<ShoppingListItemRow>> {
  const parsed = addShoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const listId = await resolveListId(supabase, auth.userId, parsed.data.listId);
  if (!listId) return { success: false, error: "not-found" };

  const last = await lastShoppingListItemPosition(supabase, listId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      // A trigger sets user_id to the basket owner; the column is required.
      user_id: auth.userId,
      list_id: listId,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      section: parsed.data.section,
      position,
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("addShoppingListItem", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand", "layout");
  return { success: true, data };
}

export async function toggleShoppingListItem(input: unknown): Promise<ActionResult> {
  const parsed = toggleShoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("shopping_list_items")
    .update({ checked: parsed.data.checked })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("toggleShoppingListItem", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/winkelmand", "layout");
  return { success: true, data: undefined };
}

export async function deleteShoppingListItem(input: unknown): Promise<ActionResult> {
  const parsed = deleteShoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteShoppingListItem", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/winkelmand", "layout");
  return { success: true, data: undefined };
}

/**
 * The header's "Alles verwijderen" -- deletes every item of one basket
 * (default: the user's default basket). An already-empty list is not an
 * error: the delete simply matches zero rows.
 */
export async function clearShoppingList(input?: unknown): Promise<ActionResult> {
  const parsed = clearShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const listId = await resolveListId(supabase, auth.userId, parsed.data.listId);
  if (!listId) return { success: false, error: "not-found" };

  const { error } = await supabase.from("shopping_list_items").delete().eq("list_id", listId);

  if (error) {
    logDbError("clearShoppingList", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand", "layout");
  return { success: true, data: undefined };
}

/**
 * The Recepten -> Boodschappenlijst hand-off (#178, ticket #29 / Architecture
 * §4.2's own rule): scaling happens here, at send time, in the app layer --
 * `shopping_list_items` never carries a servings factor. Loads the recipe
 * server-side via `getRecipeWithIngredientsAndSteps` (already ownership-
 * filtered the same way every other query in this codebase is, RLS plus an
 * explicit `user_id` check -- see that function's own doc comment), scales +
 * merges via the pure `buildShoppingListLines` (lib/shopping/send-to-list.ts,
 * which reuses `scaleIngredientRows` rather than reimplementing the
 * arithmetic), then appends the resulting lines after the user's existing
 * items -- `nextPosition` chained across the batch, same "append at the end"
 * shape `addShoppingListItem` already uses, just called once per line so
 * each new row gets its own increasing position instead of colliding on one.
 * `recipe_id` is set on every inserted row for provenance (the migration's
 * own `on delete set null` FK, #175) -- this is the source of #179's
 * Recept-grouping on the Winkelmand page. `reference_ingredient_id` (#179)
 * rides along the same merged lines, carried through from each recipe
 * ingredient's own resolved `reference.ingredients` link (lib/recipes/
 * queries.ts's `nutritionInputsForIngredients`) for #179's Voedingsgroep
 * grouping -- null wherever that chain doesn't resolve.
 */
export async function sendRecipeToShoppingList(input: unknown): Promise<ActionResult> {
  const parsed = sendRecipeToShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const recipe = await getRecipeWithIngredientsAndSteps(parsed.data.recipeId);
  if (!recipe) return { success: false, error: "not-found" };

  const lines = buildShoppingListLines(recipe.ingredients, recipe.servings, parsed.data.targetPortions);
  if (lines.length === 0) return { success: true, data: undefined };

  const listId = await resolveListId(supabase, auth.userId, parsed.data.listId);
  if (!listId) return { success: false, error: "not-found" };

  let last = await lastShoppingListItemPosition(supabase, listId);
  const rows = lines.map((line) => {
    const position = nextPosition(last, null);
    last = position;
    return {
      user_id: auth.userId,
      list_id: listId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      section: null,
      recipe_id: recipe.id,
      reference_ingredient_id: line.referenceIngredientId ?? null,
      position,
    };
  });

  const { error: insertError } = await supabase.from("shopping_list_items").insert(rows);
  if (insertError) {
    logDbError("sendRecipeToShoppingList", insertError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand", "layout");
  revalidatePath(`/recepten/${recipe.id}`);
  return { success: true, data: undefined };
}

/**
 * #179 part 2: the ReceptDetailPage ingredient row's swipe-to-cart action --
 * a single ingredient rather than `sendRecipeToShoppingList`'s whole recipe,
 * same scaling/provenance rules. Same ownership load (`getRecipeWithIngredientsAndSteps`,
 * RLS + explicit `user_id`) as the whole-recipe send; the target ingredient
 * is looked up in the already-loaded, already-ownership-checked recipe
 * rather than queried again. Unlike the bulk send, this path also merges
 * into an EXISTING `shopping_list_items` row (same name + same unit,
 * `lib/shopping/send-to-list.ts`'s own rule, `mergeSingleIngredientLine`)
 * rather than always inserting -- adding "Banaan" twice from two different
 * recipes must sum onto one line, not create two.
 */
export async function addIngredientToShoppingList(input: unknown): Promise<ActionResult> {
  const parsed = addIngredientToShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const recipe = await getRecipeWithIngredientsAndSteps(parsed.data.recipeId);
  if (!recipe) return { success: false, error: "not-found" };

  const ingredient = recipe.ingredients.find((row) => row.id === parsed.data.ingredientId);
  if (!ingredient) return { success: false, error: "not-found" };

  const listId = await resolveListId(supabase, auth.userId, parsed.data.listId);
  if (!listId) return { success: false, error: "not-found" };

  const { data: existingRows, error: existingError } = await supabase
    .from("shopping_list_items")
    .select("id, name, quantity, unit")
    .eq("list_id", listId);
  if (existingError) {
    logDbError("addIngredientToShoppingList", existingError);
    return { success: false, error: "generic" };
  }

  const merge = mergeSingleIngredientLine(
    ingredient,
    recipe.servings,
    parsed.data.targetPortions,
    existingRows ?? [],
  );

  if (merge.kind === "update") {
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ quantity: merge.quantity })
      .eq("id", merge.id);
    if (error) {
      logDbError("addIngredientToShoppingList", error);
      return { success: false, error: "generic" };
    }
  } else {
    const last = await lastShoppingListItemPosition(supabase, listId);
    const { error } = await supabase.from("shopping_list_items").insert({
      user_id: auth.userId,
      list_id: listId,
      name: merge.line.name,
      quantity: merge.line.quantity,
      unit: merge.line.unit,
      section: null,
      recipe_id: recipe.id,
      reference_ingredient_id: merge.line.referenceIngredientId ?? null,
      position: nextPosition(last, null),
    });
    if (error) {
      logDbError("addIngredientToShoppingList", error);
      return { success: false, error: "generic" };
    }
  }

  revalidatePath("/winkelmand", "layout");
  return { success: true, data: undefined };
}

/**
 * Creates a non-default basket at the end of the signed-in user's baskets.
 * The default basket is seeded elsewhere (ADR-0017); RLS only lets a client
 * insert `is_default = false` rows owned by itself.
 */
export async function createShoppingList(input: unknown): Promise<ActionResult<ShoppingListRow>> {
  const parsed = createShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: last } = await supabase
    .from("shopping_lists")
    .select("position")
    .eq("user_id", auth.userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert({
      user_id: auth.userId,
      name: parsed.data.name,
      position: nextPosition(last?.position ?? null, null),
    })
    .select()
    .single();

  if (error || !data) {
    if (error) logDbError("createShoppingList", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand", "layout");
  return { success: true, data };
}

/** Renames a basket. RLS decides access; clients may only update `name`/`position`. */
export async function renameShoppingList(input: unknown): Promise<ActionResult> {
  const parsed = renameShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shopping_lists")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.listId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("renameShoppingList", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/winkelmand", "layout");
  return { success: true, data: undefined };
}

/**
 * Deletes a basket and (by cascade) its items. The default basket is
 * protected by the delete policy, so it matches zero rows and reports
 * `not-found`.
 */
export async function deleteShoppingList(input: unknown): Promise<ActionResult> {
  const parsed = deleteShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shopping_lists")
    .delete()
    .eq("id", parsed.data.listId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteShoppingList", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  // No revalidatePath here, on purpose: the page being viewed is the deleted
  // basket, and re-rendering it would flash a 404 before the caller's own
  // navigation to the default basket lands (which renders fresh).
  return { success: true, data: undefined };
}

// #426: thin wrappers so the (client) basket panel can reach the sharing
// operations in lib/sharing/actions.ts, which is a plain server-only module
// and not itself a Server Action endpoint. They validate and authorise there
// (zod + the anon-key client, RLS decides); nothing is added here. No
// revalidatePath: the panel's caller refreshes the route after saving.

export async function searchShareMembers(input: unknown) {
  return searchMembers(input);
}

export async function inviteShareMember(input: unknown) {
  return inviteMember(input);
}

export async function revokeShareMember(input: unknown) {
  return revokeShare(input);
}
