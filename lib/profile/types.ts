import type { Database } from "@/lib/database.types";

// Read-side shapes returned by lib/profile/queries.ts, plus the write-side
// ActionResult/ProfileErrorCode contract for lib/profile/actions.ts -- same
// split as lib/notes/types.ts (#228) / lib/recipes/types.ts (#122).

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// The two values profiles.locale's check constraint allows
// (supabase/migrations/20260720000001_profiles.sql: `check (locale in
// ('nl', 'en'))`). Kept as its own exported union so lib/profile/schemas.ts
// and i18n/request.ts both validate against the same literal set instead of
// each hardcoding "nl" | "en" separately.
export type Locale = "nl" | "en";
export const LOCALES: readonly Locale[] = ["nl", "en"];

// Every write action (lib/profile/actions.ts) returns one of these instead
// of throwing or returning a bare string -- same shape and reasoning as
// lib/notes/types.ts's ActionResult/NotesErrorCode. Deliberately the small
// three-code set: no "not-found" -- every signed-in user has exactly one
// profile row (the on_auth_user_created trigger, 20260720000001_profiles.sql)
// so updateLocale never hits a missing row the way a notes/recipes id lookup
// can.
export type ProfileErrorCode = "invalid-input" | "unauthenticated" | "generic";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: ProfileErrorCode };
