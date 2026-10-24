import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Cooked meals (ADR-0044 §3): one recipe_cooked event per past meal plan. The
// RPCs are idempotent, so both entry points can run as often as they like.
type Client = SupabaseClient<Database>;

/** Lazy path: the signed-in member's own meals, with their RLS client. */
export async function settleCookedMeals(client: Client): Promise<void> {
  try {
    const { error } = await client.rpc("settle_cooked_meals");
    if (error) console.error("[activity] settle failed", error.code);
  } catch {
    console.error("[activity] settle failed");
  }
}

export type SettleAllResult = { members: number; failed: number; remaining: number };

/** Cron path (ADR-0039 §6): every member, within a time budget; the rest waits for the next run. */
export async function settleAllMembers(client: Client, options: { budgetMs: number }): Promise<SettleAllResult> {
  const deadline = Date.now() + options.budgetMs;
  const result: SettleAllResult = { members: 0, failed: 0, remaining: 0 };
  const { data: profiles, error } = await client.from("profiles").select("id");
  if (error) {
    console.error("[activity] members failed", error.code);
    result.failed++;
    return result;
  }
  for (const [index, profile] of profiles.entries()) {
    if (Date.now() >= deadline) {
      result.remaining = profiles.length - index;
      break;
    }
    const { error: settleError } = await client.rpc("settle_cooked_meals_for", { p_user: profile.id });
    if (settleError) result.failed++;
    else result.members++;
  }
  return result;
}
