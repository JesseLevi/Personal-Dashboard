import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * The signed-in user's default basket (ADR-0035 §10). Only used to pick a
 * default when the caller gave no `listId`; access to any explicit list is
 * decided by RLS, not here. `ensure_user_defaults()` seeds it on every
 * authenticated load, so null means "not seeded yet".
 */
export async function getDefaultShoppingListId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  return data?.id ?? null;
}
