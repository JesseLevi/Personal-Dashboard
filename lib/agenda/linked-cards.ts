import "server-only";
import type { LinkedCard, LinkedCards } from "@/lib/agenda/day-cards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Cards linked to an event (`calendar_event_links.card_id`) for the day cards (ADR-0059), through the RLS
// client: a card the member cannot see, or one in a done column (ADR-0050), is left out. Fails soft to "nothing".

export async function getLinkedCards(eventIds: readonly string[]): Promise<LinkedCards> {
  if (eventIds.length === 0) return {};
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("calendar_event_links")
      .select("calendar_event_id, card:cards(id, title, board_columns!inner(is_done))")
      .in("calendar_event_id", [...eventIds])
      .not("card_id", "is", null)
      .order("created_at", { ascending: true });
    if (error) return {};
    const linked: Record<string, LinkedCard[]> = {};
    for (const row of data) {
      if (!row.card || row.card.board_columns.is_done) continue;
      (linked[row.calendar_event_id] ??= []).push({ id: row.card.id, title: row.card.title });
    }
    return linked;
  } catch {
    return {};
  }
}
