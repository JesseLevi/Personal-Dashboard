/**
 * Agenda item union (ADR-0037). Types only: no server code, safe to import from
 * client components.
 *
 * Time strings: ISO 8601. A timed item carries a local date-time, with or
 * without offset (`2026-10-14T09:00:00` or `2026-10-14T09:00:00+02:00`). An all-day
 * item carries a date (`2026-10-14`) and an exclusive `end` (or null: one day).
 */
import type { AgendaColor } from "@/lib/agenda/colors";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface AgendaItemBase {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  /** Recipes, cards and notes attached to this item. */
  linkCount: number;
}

/** `calendar_events`. `sync` events are read-only in Atlas. */
export interface AgendaEventItem extends AgendaItemBase {
  kind: "event";
  source: "manual" | "sync";
  calendarId: string;
  /** Palette key of the event's calendar (ADR-0040). */
  color: AgendaColor;
  /** Set when the source no longer returns the event (`missing_since`). */
  missingSince: string | null;
  /** An occurrence of a recurring own event (`series_id` is set). */
  recurring?: boolean;
}

/** `meal_plans`, always an all-day item on its date. `title` is the recipe title. */
export interface AgendaMealItem extends AgendaItemBase {
  kind: "meal";
  slot: MealSlot;
  servings: number;
  thumbnailPath: string | null;
  /** Attached to an event instead of a day: takes the event's date. */
  attached: boolean;
  /** Order within a day and moment (`meal_plans.position`). */
  position: number;
}

/** `cards.planned_for`. `title` is the card title. */
export interface AgendaPlannedCardItem extends AgendaItemBase {
  kind: "planned_card";
  board: string;
  column: string;
}

/** `cards.due_at` overlay. Always all-day. */
export interface AgendaDeadlineItem extends AgendaItemBase {
  kind: "deadline";
}

export type AgendaItem =
  | AgendaEventItem
  | AgendaMealItem
  | AgendaPlannedCardItem
  | AgendaDeadlineItem;

export type AgendaItemKind = AgendaItem["kind"];

/** The editable fields of one event that the timeline does not carry. */
export interface AgendaEventDetail {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  source: "manual" | "sync";
  calendarId: string;
  /** Name of the calendar the event is in (the source of an imported event). */
  calendarName: string | null;
  /** The rule of the series this occurrence belongs to; null for a single event. */
  repeat: AgendaRepeatRule | null;
}

/** `calendar_event_series` rule: `until` is a date, inclusive, null = never ends. */
export interface AgendaRepeatRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  until: string | null;
}
