import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { isAgendaColor, type AgendaColor } from "@/lib/agenda/colors";
import { mapAgendaRows } from "@/lib/agenda/map";
import { groupOpenCards, type PlanBoardInput, type PlanCardGroup, type QuickAddBoard } from "@/lib/agenda/plan-cards";
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

  const [{ data, error }, colors] = await Promise.all([
    supabase.rpc("agenda_items", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_time_zone: timeZone,
    }),
    getCalendarColors(supabase),
  ]);

  if (error) {
    console.error("[agenda] getAgendaItems failed:", error.code, error.message);
    throw new Error("Failed to load agenda");
  }
  return withMealPositions(supabase, mapAgendaRows(data, timeZone, colors));
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// `agenda_items()` carries the calendar id only; the colour is mapped on here (ADR-0040).
// A failed read leaves the map empty, so events show in the fallback colour instead of the page failing.
async function getCalendarColors(supabase: Supabase): Promise<Map<string, AgendaColor>> {
  const { data, error } = await supabase.from("calendars").select("id, color");
  if (error) {
    console.error("[agenda] calendar colours failed:", error.code, error.message);
    return new Map();
  }
  return new Map(data.flatMap((row) => (isAgendaColor(row.color) ? [[row.id, row.color] as const] : [])));
}

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

/**
 * The open cards of every board the signed-in user can see, per board, for the
 * plan drawer. RLS decides which boards and cards these are (ADR-0033, ADR-0035).
 * Empty array if signed out.
 */
/**
 * The column quick add puts a new card in: the first column of the user's favourite board, else of their
 * first board. Null without a board. RLS decides what is readable (ADR-0033).
 */
export async function getQuickAddBoard(): Promise<QuickAddBoard | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("boards")
    .select("name, board_columns ( id, name, position )")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("position", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[agenda] getQuickAddBoard failed:", error.code, error.message);
    throw new Error("Failed to load the quick add board");
  }
  const board = data[0];
  const column = board ? [...board.board_columns].sort((a, b) => a.position - b.position)[0] : undefined;
  return board && column ? { boardName: board.name, columnId: column.id, columnName: column.name } : null;
}

export async function getPlannableCards(): Promise<PlanCardGroup[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("boards")
    .select("id, name, is_favorite, position, board_columns ( name, position, cards ( id, title, planned_for, position ) )")
    .overrideTypes<PlanBoardInput[], { merge: false }>();

  if (error) {
    console.error("[agenda] getPlannableCards failed:", error.code, error.message);
    throw new Error("Failed to load cards");
  }
  return groupOpenCards(data);
}
