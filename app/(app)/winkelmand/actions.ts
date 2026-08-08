"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { nextPosition } from "@/lib/boards/positioning";
import { getRecipeWithIngredientsAndSteps } from "@/lib/recipes/queries";
import { buildShoppingListLines } from "@/lib/shopping/send-to-list";
import {
  addShoppingListItemSchema,
  deleteShoppingListItemSchema,
  sendRecipeToShoppingListSchema,
  toggleShoppingListItemSchema,
} from "@/lib/shopping/schemas";
import type { ActionResult, ShoppingListItemRow } from "@/lib/shopping/types";
import type { Database } from "@/lib/database.types";

// Write side of #176 -- Winkelmand item CRUD, called from the Winkelmand UI
// (later ticket). Follows app/(app)/recepten/actions.ts's pattern exactly:
//   1. parses its input with the matching lib/shopping/schemas.ts schema
//      (every action takes a single `input: unknown`, even the ones the
//      ticket describes with positional args, because a Server Action is a
//      real network endpoint regardless of how it's invoked from the client
//      bundle -- see app/(app)/recepten/actions.ts's searchIngredients
//      comment for the same reasoning);
//   2. resolves the signed-in user and filters every query on that id
//      explicitly, on top of RLS -- ownership is enforced by the
//      shopping_list_items_*_own policies
//      (20260808000001_shopping_list_items.sql, #175), never service_role;
//   3. returns a typed ActionResult instead of throwing.
// revalidatePath("/winkelmand") runs on every successful write.

type Client = SupabaseClient<Database>;

async function requireUserId(
  supabase: Client,
): Promise<{ userId: string } | { error: "unauthenticated" }> {
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { error: "unauthenticated" };
  return { userId };
}

function logDbError(action: string, error: { code: string; message: string }) {
  console.error(`[shopping] ${action} failed:`, error.code, error.message);
}

// Position of the last row (by `position`) owned by `userId` -- the same
// "append at the end" building block as lib/recipes/'s
// lastCategoryPosition/lastRecipePosition (app/(app)/recepten/actions.ts).
async function lastShoppingListItemPosition(
  supabase: Client,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("shopping_list_items")
    .select("position")
    .eq("user_id", userId)
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
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const last = await lastShoppingListItemPosition(supabase, auth.userId);
  const position = nextPosition(last, null);

  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      user_id: auth.userId,
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

  revalidatePath("/winkelmand");
  return { success: true, data };
}

export async function toggleShoppingListItem(input: unknown): Promise<ActionResult> {
  const parsed = toggleShoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("shopping_list_items")
    .update({ checked: parsed.data.checked })
    .eq("id", parsed.data.id)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("toggleShoppingListItem", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/winkelmand");
  return { success: true, data: undefined };
}

export async function deleteShoppingListItem(input: unknown): Promise<ActionResult> {
  const parsed = deleteShoppingListItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deleteShoppingListItem", error);
    return { success: false, error: "generic" };
  }
  if (!data) return { success: false, error: "not-found" };

  revalidatePath("/winkelmand");
  return { success: true, data: undefined };
}

/**
 * The header's "Alles verwijderen" -- deletes every shopping_list_items row
 * the signed-in user owns. No input to validate. An already-empty list is
 * not an error: the delete simply matches zero rows.
 */
export async function clearShoppingList(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", auth.userId);

  if (error) {
    logDbError("clearShoppingList", error);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand");
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
 * own `on delete set null` FK, #175).
 */
export async function sendRecipeToShoppingList(input: unknown): Promise<ActionResult> {
  const parsed = sendRecipeToShoppingListSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };

  const supabase = await createSupabaseServerClient();
  const auth = await requireUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };

  const recipe = await getRecipeWithIngredientsAndSteps(parsed.data.recipeId);
  if (!recipe) return { success: false, error: "not-found" };

  const lines = buildShoppingListLines(recipe.ingredients, recipe.servings, parsed.data.targetPortions);
  if (lines.length === 0) return { success: true, data: undefined };

  let last = await lastShoppingListItemPosition(supabase, auth.userId);
  const rows = lines.map((line) => {
    const position = nextPosition(last, null);
    last = position;
    return {
      user_id: auth.userId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      section: null,
      recipe_id: recipe.id,
      position,
    };
  });

  const { error: insertError } = await supabase.from("shopping_list_items").insert(rows);
  if (insertError) {
    logDbError("sendRecipeToShoppingList", insertError);
    return { success: false, error: "generic" };
  }

  revalidatePath("/winkelmand");
  revalidatePath(`/recepten/${recipe.id}`);
  return { success: true, data: undefined };
}
