/**
 * Agenda item union (ADR-0037). Types only: no server code, safe to import from
 * client components.
 *
 * Time strings: ISO 8601. A timed item carries a local date-time, with or
 * without offset (`2026-10-14T09:00:00` or `2026-10-14T09:00:00+02:00`). An all-day
 * item carries a date (`2026-10-14`) and an exclusive `end` (or null: one day).
 */
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
  /** Set when the source no longer returns the event (`missing_since`). */
  missingSince: string | null;
}

/** `meal_plans`. `title` is the recipe title. */
export interface AgendaMealItem extends AgendaItemBase {
  kind: "meal";
  slot: MealSlot;
  servings: number;
  thumbnailPath: string | null;
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
