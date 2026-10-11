import "server-only";
import type { ImportErrorCode } from "@/lib/recipes/enums";
import type { MatcherClient } from "@/lib/recipes/import/match-ingredients";

// Per-user import rate limit (#317, ADR-0019 §5): 20 imports per hour. No
// in-memory state (Vercel instances do not share it) and no extra table: an
// import is a `recipes` row with source_url set, so the count of the user's
// such rows from the last hour is the counter. It goes through the RLS-scoped
// client, so it can only ever see the caller's own rows. Failed imports count
// too (they cost a fetch and maybe an LLM call); deleting rows frees budget,
// which is acceptable for a spend guard, the Console cap is the hard stop.

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
 * Call before inserting the new `importing` row: resolves while the user has
 * fewer than IMPORTS_PER_HOUR imports in the last hour (so the 21st is
 * refused), otherwise throws ImportRateLimitError. A database error throws a
 * plain Error: fail closed, an unknown count must not open the gate.
 */
export async function checkImportRateLimit(
  supabase: MatcherClient,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("source_url", "is", null)
    .gt("created_at", since);
  if (error) {
    console.error("[recipes] checkImportRateLimit failed:", error.code, error.message);
    throw new Error("Failed to check the import rate limit");
  }
  if ((count ?? 0) >= IMPORTS_PER_HOUR) throw new ImportRateLimitError(IMPORTS_PER_HOUR);
}
