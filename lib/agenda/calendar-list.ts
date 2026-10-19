import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FALLBACK_EVENT_COLOR, isAgendaColor } from "@/lib/agenda/colors";
import { readSyncState, type CalendarAccountView, type CalendarOverview } from "@/lib/agenda/calendars";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * The signed-in user's own categories (default first) and imported calendars with their colours,
 * for the settings panel and the event panel's category field. RLS decides what is visible (ADR-0033).
 * Returns null when a read fails, so the caller can tell that apart from "no calendars".
 */
export async function getCalendarOverview(supabase?: Supabase): Promise<CalendarOverview | null> {
  const client = supabase ?? (await createSupabaseServerClient());
  const [calendars, accounts] = await Promise.all([
    client
      .from("calendars")
      .select("id, name, kind, color, is_default, calendar_account_id")
      .order("is_default", { ascending: false })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("calendar_accounts")
      .select("id, display_name, last_synced_at, sync_state")
      .eq("provider", "ics")
      .order("created_at", { ascending: true }),
  ]);
  if (calendars.error || accounts.error) {
    const error = calendars.error ?? accounts.error;
    console.error("[agenda] getCalendarOverview failed:", error?.code);
    return null;
  }

  const byAccount = new Map(calendars.data.map((row) => [row.calendar_account_id, row]));
  const colorOf = (color: string | undefined) => (isAgendaColor(color) ? color : FALLBACK_EVENT_COLOR);

  return {
    categories: calendars.data
      .filter((row) => row.kind === "manual")
      .map((row) => ({ id: row.id, name: row.name, color: colorOf(row.color), isDefault: row.is_default })),
    accounts: accounts.data.flatMap((row): CalendarAccountView[] => {
      const calendar = byAccount.get(row.id);
      if (!calendar) return [];
      const state = readSyncState(row.sync_state);
      return [
        {
          id: row.id,
          calendarId: calendar.id,
          color: colorOf(calendar.color),
          name: row.display_name,
          status: state.status,
          lastSyncedAt: row.last_synced_at,
          errorCode: state.errorCode,
        },
      ];
    }),
  };
}
