import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextPosition } from "@/lib/boards/positioning";
import type { Database } from "@/lib/database.types";
import type { ShoppingListLine } from "@/lib/shopping/send-to-list";

// The shared "append lines at the end of a basket" write behind the recipe send
// and the Agenda's meal sends. Access to the basket is decided by RLS.

type Client = SupabaseClient<Database>;

export interface LineSource {
  recipeId: string;
  mealPlanId?: string | null;
}

async function lastShoppingListItemPosition(supabase: Client, listId: string): Promise<number | null> {
  const { data } = await supabase
    .from("shopping_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? null;
}

/** Appends `lines` after the basket's last item, one increasing position each. Returns the database error, if any. */
export async function insertShoppingListLines(
  supabase: Client,
  userId: string,
  listId: string,
  lines: readonly { line: ShoppingListLine; source: LineSource }[],
): Promise<{ code: string; message: string } | null> {
  let last = await lastShoppingListItemPosition(supabase, listId);
  const rows = lines.map(({ line, source }) => {
    const position = nextPosition(last, null);
    last = position;
    return {
      user_id: userId,
      list_id: listId,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      section: null,
      recipe_id: source.recipeId,
      meal_plan_id: source.mealPlanId ?? null,
      reference_ingredient_id: line.referenceIngredientId ?? null,
      position,
    };
  });
  const { error } = await supabase.from("shopping_list_items").insert(rows);
  return error;
}
