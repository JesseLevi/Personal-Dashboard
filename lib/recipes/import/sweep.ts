import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { IMPORT_ERROR_TIMEOUT } from "@/lib/recipes/enums";

// Lazy sweep for stuck imports (ADR-0019 §1, same idea as ADR-0017's
// ensure_user_defaults): on every Recepten board load, this user's `importing`
// rows older than 5 minutes become `failed` with import_error='timeout', in
// one update, so the database never claims an import is running when the
// function that ran it died. A plain update through the caller's RLS-scoped
// client plus an explicit user_id filter: no RPC, no migration, and other
// users' rows are unreachable by construction (RLS) and by filter.

export const IMPORT_TIMEOUT_MS = 5 * 60 * 1000;

/** Never throws: a failed sweep must not take the board down, the next load retries. Returns the number of rows it failed. */
export async function sweepStuckImports(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - IMPORT_TIMEOUT_MS).toISOString();
  const { data, error } = await supabase
    .from("recipes")
    .update({ import_status: "failed", import_error: IMPORT_ERROR_TIMEOUT })
    .eq("user_id", userId)
    .eq("import_status", "importing")
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[recipes] sweepStuckImports failed:", error.code, error.message);
    return 0;
  }
  return data?.length ?? 0;
}
