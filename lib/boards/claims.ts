import type { AuthError } from "@supabase/supabase-js";

// Pure mapping logic behind lib/boards/session.ts's getAuthenticatedUserId/
// requireUserId, split out specifically so it's unit-testable without a
// database or a request context: session.ts itself is `import "server-only"`
// (same as e.g. lib/recipes/thumbnails.ts) and throws immediately if
// imported from plain Vitest -- see tests/recipes-thumbnails.test.ts's own
// note on why its Supabase-dependent functions aren't tested directly
// either, same split applied here.

/** Structural subset of supabase.auth.getClaims()'s return value this module
 * actually reads -- just enough to type-check the real call in session.ts
 * without re-declaring supabase-js's full JwtPayload shape. */
export interface GetClaimsResult {
  data: { claims: { sub?: string } } | null;
  error: AuthError | null;
}

/** Maps a getClaims() result onto a user id: null if signed out, the JWT
 * failed verification, or the token carries no `sub` claim. */
export function userIdFromClaims(result: GetClaimsResult): string | null {
  if (result.error || !result.data) return null;
  return result.data.claims.sub ?? null;
}

/** Wraps a resolved user id (or lack of one) in the `ActionResult`-shaped
 * form every Server Action in app/(app)/te-doen/actions.ts,
 * app/(app)/recepten/actions.ts and app/(app)/winkelmand/actions.ts expects
 * from requireUserId(). */
export function requireUserIdResult(
  userId: string | null,
): { userId: string } | { error: "unauthenticated" } {
  if (!userId) return { error: "unauthenticated" };
  return { userId };
}
