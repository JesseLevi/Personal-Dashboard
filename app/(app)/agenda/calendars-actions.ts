"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/boards/session";
import {
  accountIdSchema,
  addIcsCalendarSchema,
  normalizeIcsUrl,
  readSyncState,
  resolveNoticeSchema,
  type CalendarAccountView,
  type CalendarActionResult,
  type CalendarErrorCode,
} from "@/lib/agenda/calendars";
import { applyFeed, fetchFeed } from "@/lib/agenda/sync";

// Calendar management for the signed-in user. Access is decided by RLS
// (ADR-0033). The ICS URL enters here once, goes to Vault through
// `create_ics_calendar`, and never comes back: no action returns or logs it.
// Errors are codes only.

function logDbError(action: string, error: { code: string }) {
  console.error(`[agenda] ${action} failed:`, error.code);
}

export async function listCalendarAccounts(): Promise<CalendarActionResult<CalendarAccountView[]>> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_accounts")
    .select("id, display_name, last_synced_at, sync_state")
    .eq("provider", "ics")
    .order("created_at", { ascending: true });
  if (error) {
    logDbError("listCalendarAccounts", error);
    return { success: false, error: "generic" };
  }
  return {
    success: true,
    data: data.map((row) => {
      const state = readSyncState(row.sync_state);
      return {
        id: row.id,
        name: row.display_name,
        status: state.status,
        lastSyncedAt: row.last_synced_at,
        errorCode: state.errorCode,
      };
    }),
  };
}

function feedFailure(code: string): CalendarErrorCode {
  if (code === "fetch_invalid_url" || code === "fetch_blocked_address") return "invalid-url";
  if (code === "unparsable" || code === "too_large" || code === "fetch_bad_content_type") return "unreadable";
  return "fetch-failed";
}

/** Fetches and parses first, so a link that does not work never becomes an account. */
export async function addIcsCalendar(input: unknown): Promise<CalendarActionResult<{ id: string }>> {
  const parsed = addIcsCalendarSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const url = normalizeIcsUrl(parsed.data.url);
  if (!url) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const now = new Date();
  const feed = await fetchFeed(url, now);
  if (!feed.ok) return { success: false, error: feedFailure(feed.error) };
  if (feed.events.length === 0) return { success: false, error: "empty" };

  const supabase = await createSupabaseServerClient();
  const { data: id, error } = await supabase.rpc("create_ics_calendar", {
    p_name: parsed.data.name,
    p_url: url,
  });
  if (error || typeof id !== "string") {
    if (error) logDbError("addIcsCalendar", error);
    return { success: false, error: error?.code === "54000" ? "limit" : "generic" };
  }

  // A failed first apply leaves a working account: the lazy sync retries it.
  await applyFeed(supabase, id, feed, now);
  return { success: true, data: { id } };
}

/** Deleting the account cascades its calendar, events, links and meal plans (ADR-0037 §10). */
export async function removeCalendarAccount(input: unknown): Promise<CalendarActionResult> {
  const parsed = accountIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("calendar_accounts").delete().eq("id", parsed.data.id).select("id");
  if (error) {
    logDbError("removeCalendarAccount", error);
    return { success: false, error: "generic" };
  }
  if (data.length === 0) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}

/**
 * Dismisses a basket notice; `removeItems` also deletes the open items it lists.
 * The item ids come from the stored notice, never from the client.
 */
export async function resolveSyncNotice(input: unknown): Promise<CalendarActionResult> {
  const parsed = resolveNoticeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { data: notice, error } = await supabase
    .from("calendar_sync_notices")
    .select("id, item_ids")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (error) {
    logDbError("resolveSyncNotice", error);
    return { success: false, error: "generic" };
  }
  if (!notice) return { success: false, error: "not-found" };

  if (parsed.data.removeItems && notice.item_ids.length > 0) {
    const { error: removeError } = await supabase
      .from("shopping_list_items")
      .delete()
      .in("id", notice.item_ids)
      .eq("checked", false);
    if (removeError) {
      logDbError("resolveSyncNotice items", removeError);
      return { success: false, error: "generic" };
    }
  }
  const { error: dismissError } = await supabase.from("calendar_sync_notices").delete().eq("id", notice.id);
  if (dismissError) {
    logDbError("resolveSyncNotice dismiss", dismissError);
    return { success: false, error: "generic" };
  }
  return { success: true, data: undefined };
}
