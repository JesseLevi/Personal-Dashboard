import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { widgetTodayResultSchema, type WidgetDay } from "@/lib/widget/contract";
import { buildWidgetDay, toWidgetLocale, widgetRange } from "@/lib/widget/day";
import type { WidgetOutcome } from "@/lib/widget/http";

// Calls public.widget_today (ADR-0047 §4) through a stateless anon client: no
// cookies, no session, no service_role. The plaintext token goes to the database,
// which hashes it; never log the token.

// PostgREST "function not found" / Postgres undefined_function: code deployed before its migration.
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

export type WidgetTodayResult = { outcome: "ok"; day: WidgetDay } | { outcome: Exclude<WidgetOutcome, "ok"> };

export async function getWidgetToday(token: string, timeZone: string, now: Date = new Date()): Promise<WidgetTodayResult> {
  try {
    const { from, to } = widgetRange(now, timeZone);
    const { data, error } = await createSupabaseAnonClient().rpc("widget_today", {
      p_token: token,
      p_from: from,
      p_to: to,
      p_time_zone: timeZone,
    });
    if (error) {
      if (error.code && MISSING_FUNCTION_CODES.has(error.code)) {
        console.error("widget_today is missing: apply the pending migration");
        return { outcome: "unavailable" };
      }
      console.error("[widget] widget_today failed:", error.code);
      return { outcome: "error" };
    }
    const result = widgetTodayResultSchema.parse(data);
    if (result.status !== "ok") return { outcome: result.status };
    return { outcome: "ok", day: buildWidgetDay({ rows: result.items, locale: toWidgetLocale(result.locale), timeZone, now }) };
  } catch (error) {
    console.error("[widget] getWidgetToday failed:", error instanceof Error ? error.name : "unknown");
    return { outcome: "error" };
  }
}
