import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { IngredientRow } from "@/lib/recipes/types";

type Client = SupabaseClient<Database>;

/**
 * Materialises a `public.ingredients` row for `userId` (ADR-0011 §2), the one
 * path shared by the manual flow (createOwnIngredient in
 * app/(app)/recepten/actions.ts) and the recipe importer (#316). With a
 * `referenceId` it reuses the user's existing row for that reference
 * ingredient instead of inserting a duplicate; with `null` it always inserts
 * a self-added, unlinked ingredient. Runs on the caller's RLS-bound client.
 */
export async function findOrCreateOwnIngredient(
  supabase: Client,
  userId: string,
  input: { name: string; referenceId: string | null },
): Promise<{ ok: true; ingredient: IngredientRow } | { ok: false }> {
  if (input.referenceId) {
    const { data: existing, error: existingError } = await supabase
      .from("ingredients")
      .select("*")
      .eq("user_id", userId)
      .eq("reference_id", input.referenceId)
      .maybeSingle();
    if (existingError) {
      console.error("[recipes] findOrCreateOwnIngredient/existing-lookup failed:", existingError.code, existingError.message);
      return { ok: false };
    }
    if (existing) return { ok: true, ingredient: existing };
  }

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ user_id: userId, reference_id: input.referenceId, name: input.name })
    .select()
    .single();

  if (error || !data) {
    if (error) console.error("[recipes] findOrCreateOwnIngredient failed:", error.code, error.message);
    return { ok: false };
  }
  return { ok: true, ingredient: data };
}
