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
  return mapAgendaRows(data, timeZone);
}
