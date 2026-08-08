import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import type { ShoppingListItemRow } from "@/lib/shopping/types";

// Read side of #176 (mirrors lib/recipes/queries.ts's
// getRecipeCategoriesWithRecipes). Server-only, via the anon-key server
// client (RLS applies, ADR-0002/0003) -- the browser never talks to
// Supabase directly, and service_role never appears here.

/**
 * Every shopping_list_items row belonging to the signed-in user, ordered by
 * `position` -- the shape the Winkelmand page (later ticket) needs in one
 * round trip. Empty array if signed out, same "no session, nothing to
 * return" convention as lib/recipes/queries.ts.
 */
export async function getShoppingListItems(): Promise<ShoppingListItemRow[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    // Explicit ownership filter alongside RLS -- see the module comment on
    // lib/recipes/queries.ts's own getRecipeCategoriesWithRecipes for why
    // this isn't redundant with RLS.
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[shopping] getShoppingListItems failed:", error.code, error.message);
    throw new Error("Failed to load shopping list");
  }

  return data;
}
