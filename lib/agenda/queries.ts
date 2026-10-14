import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { mapAgendaRows } from "@/lib/agenda/map";
import type { AgendaItem } from "@/lib/agenda/types";

// There is no stored user time zone yet, so the caller passes an IANA name
// (e.g. from the request or a future profile setting).
const timeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "invalid time zone");

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  timeZone: timeZoneSchema,
});

/**
 * Every agenda item overlapping [from, to) for the signed-in user: events,
 * meal plans, planned cards and card deadlines, in one RPC. RLS decides what is
 * visible (ADR-0033). Empty array if signed out.
 */
export async function getAgendaItems(input: {
  from: Date | string;
  to: Date | string;
  timeZone: string;
}): Promise<AgendaItem[]> {
  const { from, to, timeZone } = rangeSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase.rpc("agenda_items", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_time_zone: timeZone,
  });

  if (error) {
    console.error("[agenda] getAgendaItems failed:", error.code, error.message);
    throw new Error("Failed to load agenda");
  }
  return withMealPositions(supabase, mapAgendaRows(data, timeZone));
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// The timeline function carries no `position`, so meals get it in one extra read.
async function withMealPositions(supabase: Supabase, items: AgendaItem[]): Promise<AgendaItem[]> {
  const ids = items.filter((item) => item.kind === "meal").map((item) => item.id);
  if (ids.length === 0) return items;
  const { data, error } = await supabase.from("meal_plans").select("id, position").in("id", ids);
  if (error) {
    console.error("[agenda] meal positions failed:", error.code, error.message);
    return items;
  }
  const positions = new Map(data.map((row) => [row.id, row.position]));
  return items.map((item) => (item.kind === "meal" ? { ...item, position: positions.get(item.id) ?? item.position } : item));
}
