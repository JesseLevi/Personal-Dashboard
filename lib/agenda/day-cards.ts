// The Agenda's day cards (ADR-0059): one day's items grouped for a glance. Pure; the page
// derives them from the items it already loaded, after the hidden-calendar filter.
import { mealSlotRank } from "@/lib/agenda/meals";
import type { AgendaDeadlineItem, AgendaEventItem, AgendaItem, AgendaMealItem, AgendaPlannedCardItem } from "@/lib/agenda/types";

/** Rows the timeline card and the to-do card show before "+N meer". */
export const TIMELINE_LIMIT = 5;
export const TODO_LIMIT = 3;

export type DayCardItem = AgendaPlannedCardItem | AgendaDeadlineItem;

export interface DayGroups {
  events: AgendaEventItem[];
  meals: AgendaMealItem[];
  cards: DayCardItem[];
}

const dayOf = (value: string) => value.slice(0, 10);
const wallClock = (value: string) => value.slice(0, 16);

/** Whether `item` falls on `day` (`YYYY-MM-DD`). An all-day end is exclusive, and so is a timed end at 00:00 on a later day. */
export function itemOnDay(item: AgendaItem, day: string): boolean {
  const first = dayOf(item.start);
  if (first > day) return false;
  if (first === day || !item.end) return first === day;
  const last = dayOf(item.end);
  if (item.allDay) return day < last;
  return item.end.slice(11, 16) === "00:00" ? day < last : day <= last;
}

const startKey = (item: AgendaItem) => (item.allDay ? "" : wallClock(item.start));

/** The day's items by kind: all-day events first, then by start; meals by moment; planned cards before deadlines, then by title. */
export function groupDay(items: readonly AgendaItem[], day: string): DayGroups {
  const onDay = items.filter((item) => itemOnDay(item, day));
  const events = onDay
    .filter((item): item is AgendaEventItem => item.kind === "event")
    .sort((a, b) => startKey(a).localeCompare(startKey(b)) || a.title.localeCompare(b.title));
  const meals = onDay
    .filter((item): item is AgendaMealItem => item.kind === "meal")
    .sort((a, b) => mealSlotRank(a.slot) - mealSlotRank(b.slot) || a.position - b.position);
  const cards = onDay
    .filter((item): item is DayCardItem => item.kind === "planned_card" || item.kind === "deadline")
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === "planned_card" ? -1 : 1));
  return { events, meals, cards };
}

export function isEmptyDay(groups: DayGroups): boolean {
  return groups.events.length === 0 && groups.meals.length === 0 && groups.cards.length === 0;
}

/** A card linked to an event (`calendar_event_links`), for the "Te doen" card. */
export interface LinkedCard {
  id: string;
  title: string;
}

/** `event id -> linked cards`, in link order. */
export type LinkedCards = Readonly<Record<string, readonly LinkedCard[]>>;

/** The cards linked to the day's events, once each, without the ones already planned or due that day. */
export function linkedDayCards(groups: DayGroups, linked: LinkedCards): LinkedCard[] {
  const seen = new Set(groups.cards.map((card) => card.id));
  return groups.events.flatMap((event) =>
    (linked[event.id] ?? []).filter((card) => !seen.has(card.id) && (seen.add(card.id), true)),
  );
}

/** The day cards have nothing to show: no items on `day`, and on today no signals either. */
export function isEmptyDayCards(items: readonly AgendaItem[], day: string, today: string, signalCount: number): boolean {
  return isEmptyDay(groupDay(items, day)) && (day !== today || signalCount === 0);
}

/** The first `max` rows and how many are left for "+N meer"; `expanded` shows them all. */
export function limitRows<T>(rows: readonly T[], max: number, expanded = false): { shown: T[]; more: number } {
  if (expanded || rows.length <= max) return { shown: [...rows], more: 0 };
  return { shown: rows.slice(0, max), more: rows.length - max };
}

/** "09:00" from a local date-time (`2026-11-01T09:00:00`, with or without offset). */
export function clockOf(start: string): string {
  return start.slice(11, 16);
}

/** "09:00–10:00" or "09:00"; null for an all-day event. */
export function timeLabel(event: AgendaEventItem): string | null {
  if (event.allDay) return null;
  const end = event.end ? clockOf(event.end) : null;
  return end && end !== clockOf(event.start) ? `${clockOf(event.start)}–${end}` : clockOf(event.start);
}

export type TimelineState = "past" | "now" | "upcoming";

/** Past, running or upcoming at `now` (`YYYY-MM-DDTHH:mm`, Agenda zone). An all-day event is always upcoming. */
export function timelineState(event: AgendaEventItem, now: string): TimelineState {
  if (event.allDay) return "upcoming";
  const start = wallClock(event.start);
  const end = event.end ? wallClock(event.end) : start;
  if (end <= now) return "past";
  return start <= now ? "now" : "upcoming";
}

/** The event an attached meal hangs on, looked up in the loaded window; null for a day meal or an event that is not loaded (or hidden). */
export function attachedEventTitle(meal: AgendaMealItem, items: readonly AgendaItem[]): string | null {
  if (!meal.eventId) return null;
  const event = items.find((item): item is AgendaEventItem => item.kind === "event" && item.id === meal.eventId);
  return event ? event.title : null;
}

/** The ids of the events with at least one attached meal, for the timeline icon. */
export function eventIdsWithMeals(items: readonly AgendaItem[]): Set<string> {
  return new Set(items.flatMap((item) => (item.kind === "meal" && item.eventId ? [item.eventId] : [])));
}

export interface BasketSuggestion {
  /** The day's meals no basket item points at yet. */
  mealIds: string[];
  /** The first one's recipe title, for the single-meal sentence. */
  title: string;
}

/** One suggestion per day: the meals without a `shopping_list_items.meal_plan_id`. Null when all are in the basket. */
export function basketSuggestion(meals: readonly AgendaMealItem[], inBasket: ReadonlySet<string>): BasketSuggestion | null {
  const open = meals.filter((meal) => !inBasket.has(meal.id));
  return open.length === 0 ? null : { mealIds: open.map((meal) => meal.id), title: open[0].title };
}
