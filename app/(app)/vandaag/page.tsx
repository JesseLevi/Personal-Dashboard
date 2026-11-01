import { getAgendaItems } from "@/lib/agenda/queries";
import { AGENDA_TIME_ZONE, addDays, todayInAgendaZone, wallClockToUtc } from "@/lib/agenda/time";
import { listAssistantSignals } from "@/lib/assistant/signals";
import { getRecipeBaskets } from "@/lib/shopping/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { groupToday } from "@/lib/today/day";
import { VandaagPage } from "./VandaagPage";

// "Vandaag" (ADR-0057): the landing page. Reads only through the RLS client.

async function openBasketItems(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("shopping_list_items")
    .select("id", { count: "exact", head: true })
    .eq("checked", false);
  return error ? 0 : (count ?? 0);
}

async function signals() {
  try {
    return await listAssistantSignals(await createSupabaseServerClient(), { limit: 5 });
  } catch {
    return [];
  }
}

export default async function VandaagRoute() {
  const today = todayInAgendaZone();
  const [items, basketCount, todaySignals, baskets] = await Promise.all([
    getAgendaItems({
      from: wallClockToUtc(`${today}T00:00:00`),
      to: wallClockToUtc(`${addDays(today, 1)}T00:00:00`),
      timeZone: AGENDA_TIME_ZONE,
    }),
    openBasketItems(),
    signals(),
    getRecipeBaskets(),
  ]);

  return <VandaagPage today={today} groups={groupToday(items)} basketCount={basketCount} signals={todaySignals} baskets={baskets} />;
}
