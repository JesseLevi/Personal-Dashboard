// The "Vandaag" page's day (ADR-0053): today's Agenda items, grouped for one
// glance. Pure; the page loads the items with the Agenda's own query.
import { mealSlotRank } from "@/lib/agenda/meals";
import type { AgendaDeadlineItem, AgendaEventItem, AgendaItem, AgendaMealItem, AgendaPlannedCardItem } from "@/lib/agenda/types";

export interface TodayGroups {
  events: AgendaEventItem[];
  meals: AgendaMealItem[];
  cards: (AgendaPlannedCardItem | AgendaDeadlineItem)[];
}

const startOf = (item: AgendaItem) => (item.allDay ? "" : item.start);

/** All-day events first, then by start; meals by moment; planned cards before deadlines, then by title. */
export function groupToday(items: readonly AgendaItem[]): TodayGroups {
  const events = items
    .filter((item): item is AgendaEventItem => item.kind === "event")
    .sort((a, b) => startOf(a).localeCompare(startOf(b)) || a.title.localeCompare(b.title));
  const meals = items
    .filter((item): item is AgendaMealItem => item.kind === "meal")
    .sort((a, b) => mealSlotRank(a.slot) - mealSlotRank(b.slot) || a.position - b.position);
  const cards = items
    .filter((item): item is AgendaPlannedCardItem | AgendaDeadlineItem => item.kind === "planned_card" || item.kind === "deadline")
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === "planned_card" ? -1 : 1));
  return { events, meals, cards };
}

/** "09:00" from a local date-time (`2026-11-01T09:00:00`, with or without offset). */
export function clockOf(start: string): string {
  return start.slice(11, 16);
}
