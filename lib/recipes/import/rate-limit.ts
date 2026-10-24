import "server-only";
import type { ImportErrorCode } from "@/lib/recipes/enums";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Per-user import rate limit (#317, ADR-0019 §5): 20 imports per hour. No
// in-memory state (Vercel instances do not share it). The counter is the
// append-only `private.recipe_import_attempts`, written only by the security
// definer `consume_recipe_import_attempt()` (acts on auth.uid(), checks and
// records atomically). It is deliberately not derived from `recipes` rows:
// users can delete those. Failed imports and retries count too (they cost a
// fetch and maybe an LLM call). Keep the limit equal to the one in the
// migration; the Console cap is the hard stop.

export const IMPORTS_PER_HOUR = 20;
export const IMPORT_RATE_LIMIT_ERROR: ImportErrorCode = "rate_limited";

export class ImportRateLimitError extends Error {
  readonly code = IMPORT_RATE_LIMIT_ERROR;
  constructor(readonly limit: number) {
    super(`Import rate limit reached (${limit} per hour)`);
    this.name = "ImportRateLimitError";
  }
}

/**
 * Call before inserting the new `importing` row: records one attempt and
 * resolves while the user has fewer than IMPORTS_PER_HOUR in the last hour
 * (so the 21st is refused), otherwise throws ImportRateLimitError. A database
 * error throws a plain Error: fail closed, an unknown count must not open the
 * gate.
 */
export async function checkImportRateLimit(supabase: Pick<SupabaseClient<Database>, "rpc">): Promise<void> {
  const { data, error } = await supabase.rpc("consume_recipe_import_attempt");
  if (error) {
    console.error("[recipes] checkImportRateLimit failed:", error.code, error.message);
    throw new Error("Failed to check the import rate limit");
  }
  if (data !== true) throw new ImportRateLimitError(IMPORTS_PER_HOUR);
}
