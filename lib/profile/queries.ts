import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/profile/session";
import { LOCALES, type Locale } from "@/lib/profile/types";

// #162: the read side i18n/request.ts calls on every request (including
// signed-out ones and /login) to resolve the active locale. Every failure
// mode -- signed out, missing profile row, a DB error, a value that somehow
// isn't in LOCALES -- falls back to "nl" rather than throwing, because
// getRequestConfig runs on every request and must never turn a locale
// lookup into a hard error or redirect (next-intl's contract).
//
// cache()'d so the several next-intl/RSC calls that resolve the locale
// within one request dedupe onto a single query, same reasoning as
// lib/boards/session.ts's getAuthenticatedUserId (which this function calls
// and which is itself cache()'d) -- see that file's header comment for the
// full argument-free + cache() rationale.
export const getUserLocale = cache(async (): Promise<Locale> => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return "nl";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[profile] getUserLocale failed:", error.code, error.message);
    return "nl";
  }
  if (!data) return "nl";

  // Defensive re-validation against the same allowed set profiles.locale's
  // check constraint enforces -- the column can only ever hold "nl"/"en",
  // but this keeps getRequestConfig safe even if that ever changes out from
  // under this code (a migration widening the constraint, a manual edit).
  const locale = data.locale;
  return (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "nl";
});
