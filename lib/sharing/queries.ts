import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { memberProfiles } from "@/lib/sharing/actions";
import type { ListShare } from "@/lib/sharing/types";

// Read side of sharing for the owner's basket panel. Anon-key server client,
// so RLS decides what is visible (ADR-0033); never service_role.

/**
 * The share the signed-in owner has on a basket (v1: at most one member per
 * basket, ADR-0035 point 11), with the member's profile. Null when the
 * basket is not shared, is not the caller's, or the profile cannot be read.
 */
export async function getShoppingListShare(listId: string): Promise<ListShare | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shares")
    .select("member_id, status")
    .eq("shopping_list_id", listId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[sharing] getShoppingListShare failed:", error.code, error.message);
    return null;
  }
  if (!data || (data.status !== "pending" && data.status !== "accepted")) return null;

  const profiles = await memberProfiles({ ids: [data.member_id] });
  const member = profiles.success ? profiles.data[0] : undefined;
  return member ? { member, status: data.status } : null;
}
