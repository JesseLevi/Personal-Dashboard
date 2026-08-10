import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserIdResult, userIdFromClaims } from "@/lib/boards/claims";

// Shared by lib/boards/queries.ts and app/(app)/te-doen/actions.ts (and, via
// lib/recipes/session.ts's re-export, every recipes/shopping call site too):
// RLS is the real ownership boundary, but every read/write also filters on
// this id explicitly rather than trusting a client-supplied user_id (ADR-0002
// / ADR-0003, and the "don't trust the client for ownership" note on #92).
//
// #168: was `getAuthenticatedUserId(supabase)` calling `supabase.auth.
// getUser()` -- a network round trip to Supabase Auth on every call, and a
// page render could hit it three to six times (once per query/action that
// resolves the caller). Two changes fix that:
//   1. Argument-free + cache()'d: builds its own (also cache()'d, see
//      lib/supabase/server.ts) Supabase client instead of taking one as a
//      parameter, so every call within a single request/RSC render —
//      regardless of which module makes it — dedupes onto one underlying
//      getClaims() call.
//   2. getClaims() instead of getUser(): JWT Signing Keys were enabled on
//      the Supabase project 2026-08-08 (asymmetric ES256, confirmed via the
//      project's /auth/v1/.well-known/jwks.json — a "kid" + non-"HS"-prefixed
//      alg is present), so supabase-js verifies the access token's signature
//      locally via WebCrypto instead of calling the Auth server. This is
//      still a real verification, not a blind trust of client-supplied
//      claims: per supabase-js's GoTrueClient.getClaims() (confirmed against
//      the installed 2.x source via context7, not from memory), a symmetric
//      (HS*) algorithm or a missing `kid` makes it fall back to a full
//      `getUser()` network call automatically — this project only pays zero
//      latency because signing keys are actually on, and would silently keep
//      working (just at the old cost) if they were ever turned off.
// The claims -> userId mapping itself lives in lib/boards/claims.ts (a pure,
// "server-only"-free module) so it's unit-testable — see tests/
// boards-claims.test.ts.
export const getAuthenticatedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.auth.getClaims();
  return userIdFromClaims(result);
});

// Server Action guard: resolves the signed-in user id in the
// `ActionResult`-shaped form every action in app/(app)/te-doen/actions.ts,
// app/(app)/recepten/actions.ts and app/(app)/winkelmand/actions.ts expects
// (`{ userId } | { error: "unauthenticated" }`), so callers can keep writing
// `if ("error" in auth) return { success: false, error: auth.error };`
// unchanged. Previously three near-identical copies of this exact function
// lived locally in each of those three action files (one per module, each
// taking its own `supabase` client as an argument); #168 collapses them into
// this one, argument-free, cache()'d helper now that getAuthenticatedUserId
// no longer needs a caller-supplied client either.
export const requireUserId = cache(
  async (): Promise<{ userId: string } | { error: "unauthenticated" }> => {
    const userId = await getAuthenticatedUserId();
    return requireUserIdResult(userId);
  },
);
