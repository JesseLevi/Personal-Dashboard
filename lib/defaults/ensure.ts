import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// #293 / ADR-0017: lazily applies every per-user default seed (board, recipe
// categories, note categories, and any future seed registered in
// public.ensure_user_defaults()) for accounts the `after insert on auth.users`
// triggers never reached. One RPC, scoped to auth.uid() in SQL -- no user id
// is passed from here. Idempotent and concurrency-safe in SQL; the steady
// state costs one indexed count. cache()'d so one request calls it once.
//
// Never throws: a failed seed must not take the whole app shell down, the
// next load simply retries.

export const ensureUserDefaults = cache(async (): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ensure_user_defaults");
  if (error) {
    console.error("[defaults] ensure_user_defaults failed:", error.code, error.message);
  }
});
