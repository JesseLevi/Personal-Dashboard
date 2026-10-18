"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/boards/session";
import {
  MAX_CATEGORIES,
  accountIdSchema,
  addIcsCalendarSchema,
  calendarIdSchema,
  createCalendarSchema,
  normalizeIcsUrl,
  resolveNoticeSchema,
  updateCalendarSchema,
  type CalendarActionResult,
  type CalendarErrorCode,
  type CalendarOverview,
} from "@/lib/agenda/calendars";
import { getCalendarOverview } from "@/lib/agenda/calendar-list";
import { applyFeed, fetchFeed } from "@/lib/agenda/sync";

// Calendar management for the signed-in user. Access is decided by RLS
// (ADR-0033). The ICS URL enters here once, goes to Vault through
// `create_ics_calendar`, and never comes back: no action returns or logs it.
// Errors are codes only.

function logDbError(action: string, error: { code: string }) {
  console.error(`[agenda] ${action} failed:`, error.code);
}

// AG403 / AG404 come from delete_calendar_moving_contents (the default or an imported calendar, not found).
const DB_ERROR_CODES: Record<string, CalendarErrorCode> = {
  "42501": "read-only",
  AG403: "read-only",
  AG404: "not-found",
  "23514": "invalid-input",
};

export async function listCalendars(): Promise<CalendarActionResult<CalendarOverview>> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const overview = await getCalendarOverview();
  return overview ? { success: true, data: overview } : { success: false, error: "generic" };
}

/** A new own calendar, a category (ADR-0040). The colour is the caller's choice, since the UI shows it before saving. */
export async function createCalendar(input: unknown): Promise<CalendarActionResult<{ id: string }>> {
  const parsed = createCalendarSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("calendars")
    .select("id", { count: "exact", head: true })
    .eq("kind", "manual");
  if (countError) {
    logDbError("createCalendar count", countError);
    return { success: false, error: "generic" };
  }
  if ((count ?? 0) >= MAX_CATEGORIES) return { success: false, error: "category-limit" };

  const { data, error } = await supabase
    .from("calendars")
    .insert({ user_id: auth.userId, kind: "manual", name: parsed.data.name, color: parsed.data.color })
    .select("id")
    .single();
  if (error || !data) {
    if (error) logDbError("createCalendar", error);
    return { success: false, error: (error && DB_ERROR_CODES[error.code]) || "generic" };
  }
  return { success: true, data: { id: data.id } };
}

/** Renames and/or recolours a calendar. Only an own, non-default calendar can be renamed. */
export async function updateCalendar(input: unknown): Promise<CalendarActionResult> {
  const parsed = updateCalendarSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const { id, name, color } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: calendar, error: readError } = await supabase
    .from("calendars")
    .select("id, kind, is_default")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    logDbError("updateCalendar read", readError);
    return { success: false, error: "generic" };
  }
  if (!calendar) return { success: false, error: "not-found" };
  if (name !== undefined && (calendar.is_default || calendar.kind !== "manual")) {
    return { success: false, error: "invalid-input" };
  }

  const { data, error } = await supabase
    .from("calendars")
    .update({ ...(name !== undefined && { name }), ...(color !== undefined && { color }) })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    logDbError("updateCalendar", error);
    return { success: false, error: DB_ERROR_CODES[error.code] ?? "generic" };
  }
  if (!data) return { success: false, error: "not-found" };
  return { success: true, data: undefined };
}

/** Deletes a category; its events, series and meal plans go to the default calendar first (ADR-0040 §5). */
export async function deleteCalendar(input: unknown): Promise<CalendarActionResult> {
  const parsed = calendarIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_calendar_moving_contents", { p_calendar_id: parsed.data.id });
  if (error) {
    logDbError("deleteCalendar", error);
    return { success: false, error: DB_ERROR_CODES[error.code] ?? "generic" };
  }
  return { success: true, data: undefined };
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
