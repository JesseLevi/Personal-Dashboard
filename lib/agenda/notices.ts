import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncNoticeView } from "@/lib/agenda/calendars";

// Basket notices (ADR-0037 §6) for the signed-in user. RLS shows only their own
// notices and their own basket items; a notice whose items are all gone (checked
// off or deleted) has nothing left to decide and is left out.
export async function getSyncNotices(): Promise<SyncNoticeView[]> {
  const supabase = await createSupabaseServerClient();
  const { data: notices, error } = await supabase
    .from("calendar_sync_notices")
    .select("id, event_title, item_ids")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[agenda] getSyncNotices failed:", error.code);
    return [];
  }
  const ids = [...new Set(notices.flatMap((notice) => notice.item_ids))];
  if (ids.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("shopping_list_items")
    .select("id, name")
    .in("id", ids)
    .eq("checked", false);
  if (itemsError) {
    console.error("[agenda] getSyncNotices items failed:", itemsError.code);
    return [];
  }
  const names = new Map(items.map((item) => [item.id, item.name]));
  return notices
    .map((notice) => ({
      id: notice.id,
      eventTitle: notice.event_title,
      items: notice.item_ids.flatMap((id) => (names.has(id) ? [{ id, name: names.get(id)! }] : [])),
    }))
    .filter((notice) => notice.items.length > 0);
}
