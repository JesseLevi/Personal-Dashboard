import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/boards/session";
import { mealSlotRank } from "@/lib/agenda/meals";
import type { MealSlot } from "@/lib/agenda/types";
import {
  AGENDA_LINK_KINDS,
  LINK_COLUMN,
  LINK_SEARCH_LIMIT,
  sortEventRefs,
  type AgendaEventMeal,
  type AgendaEventRef,
  type AgendaLink,
  type AgendaLinkCandidate,
  type AgendaLinkKind,
} from "@/lib/agenda/links";

// Reads for event links. RLS decides what is visible: a link only shows when
// the caller can read the event and the linked recipe, card or note (ADR-0037 s4),
// so there are no app-side ownership filters here (ADR-0035).

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function fail(action: string, error: { code: string; message: string }): never {
  console.error(`[agenda] ${action} failed:`, error.code, error.message);
  throw new Error(`Failed to ${action}`);
}

/** The links of one event, oldest first, each with the target's current title. */
export async function getEventLinks(eventId: string): Promise<AgendaLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_event_links")
    .select("id, created_at, recipe:recipes(id, title), card:cards(id, title), note:notes(id, title)")
    .eq("calendar_event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) fail("load event links", error);

  return data.flatMap((row): AgendaLink[] => {
    if (row.recipe) return [{ id: row.id, kind: "recipe", targetId: row.recipe.id, title: row.recipe.title }];
    if (row.card) return [{ id: row.id, kind: "card", targetId: row.card.id, title: row.card.title }];
    if (row.note) return [{ id: row.id, kind: "note", targetId: row.note.id, title: row.note.title }];
    return [];
  });
}

/** The meals attached to one event, by moment, each with the recipe's current title. */
export async function getEventMeals(eventId: string): Promise<AgendaEventMeal[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, slot, recipe:recipes(id, title)")
    .eq("calendar_event_id", eventId)
    .order("position", { ascending: true });
  if (error) fail("load event meals", error);

  return data
    .flatMap((row): AgendaEventMeal[] =>
      row.recipe ? [{ id: row.id, recipeId: row.recipe.id, title: row.recipe.title, slot: row.slot as MealSlot }] : [],
    )
    .sort((a, b) => mealSlotRank(a.slot) - mealSlotRank(b.slot));
}

/** The events linked to one recipe, card or note, upcoming first. */
export async function getEventRefsForTarget(kind: AgendaLinkKind, targetId: string): Promise<AgendaEventRef[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_event_links")
    .select("event:calendar_events(id, title, starts_at, all_day)")
    .eq(LINK_COLUMN[kind], targetId);
  if (error) fail("load target links", error);

  const refs = data.flatMap(({ event }): AgendaEventRef[] =>
    event ? [{ id: event.id, title: event.title, startsAt: event.starts_at, allDay: event.all_day }] : [],
  );
  return sortEventRefs(refs, new Date());
}

/**
 * `getEventRefsForTarget` for a server page that must render without it: a
 * failure (for example agenda tables not migrated yet) yields no line, not an error page.
 */
export async function getEventRefsOrEmpty(kind: AgendaLinkKind, targetId: string): Promise<AgendaEventRef[]> {
  try {
    return await getEventRefsForTarget(kind, targetId);
  } catch (error) {
    // A cookies read inside a static render signals "make this dynamic"; never swallow it.
    if (error instanceof Error && "digest" in error && error.digest === "DYNAMIC_SERVER_USAGE") throw error;
    return [];
  }
}

/** Recipes, cards and notes (or only `kinds`) whose title contains the query, a few of each. Empty if signed out. */
export async function searchLinkTargets(
  query: string,
  kinds: readonly AgendaLinkKind[] = AGENDA_LINK_KINDS,
): Promise<AgendaLinkCandidate[]> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];
  const supabase = await createSupabaseServerClient();
  const pattern = `%${escapeIlike(query)}%`;

  const none = Promise.resolve({ data: [], error: null });
  const [recipes, cards, notes] = await Promise.all([
    kinds.includes("recipe")
      ? supabase.from("recipes").select("id, title").ilike("title", pattern).order("title").limit(LINK_SEARCH_LIMIT)
      : none,
    kinds.includes("card")
      ? supabase.from("cards").select("id, title").ilike("title", pattern).order("title").limit(LINK_SEARCH_LIMIT)
      : none,
    kinds.includes("note")
      ? supabase
          .from("notes")
          .select("id, title")
          .ilike("title", pattern)
          .order("updated_at", { ascending: false })
          .limit(LINK_SEARCH_LIMIT)
      : none,
  ]);
  if (recipes.error) fail("search recipes", recipes.error);
  if (cards.error) fail("search cards", cards.error);
  if (notes.error) fail("search notes", notes.error);

  return [
    ...recipes.data.map((row): AgendaLinkCandidate => ({ kind: "recipe", ...row })),
    ...cards.data.map((row): AgendaLinkCandidate => ({ kind: "card", ...row })),
    ...notes.data.map((row): AgendaLinkCandidate => ({ kind: "note", ...row })),
  ];
}
