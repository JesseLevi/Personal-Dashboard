import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Tops up the signed-in user's recurring events to 400 days ahead (ADR-0042 §3). Runs in `after()`
 * with the user's RLS-bound client, next to the lazy sync (ADR-0039); never throws, so a failed
 * extension cannot hurt the page. The database decides which series fall short.
 */
export async function extendEventSeries(supabase: SupabaseClient<Database>): Promise<void> {
  const { error } = await supabase.rpc("extend_event_series");
  if (error) console.error("[agenda] extend_event_series failed:", error.code, error.message);
}
