import { z } from "zod";
import type { AgendaItem } from "@/lib/agenda/types";

// Pure half of lib/agenda: row validation and mapping to the AgendaItem union.
// Kept free of server-only so vitest can import it.
//
// Storage is UTC. Timed items are shown as local date-times in the user's time
// zone (no offset, so the calendar renders the wall-clock time). All-day events
// are stored as UTC midnight and read back as that UTC date; date-only meals
// and planned cards already are dates; a deadline (due_at) takes its date in
// the user's time zone.
//
// Ids: the row id of the source table, which is unique per kind. A card can
// appear as both a planned_card and a deadline, so a deadline's id is
// "deadline:<card id>"; strip the prefix to get the card id.

const MEAL_SLOT = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const agendaRowSchema = z.object({
  kind: z.enum(["event", "meal", "planned_card", "deadline"]),
  id: z.string().uuid(),
  title: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  all_day: z.boolean(),
  planned_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  link_count: z.number().int().nonnegative(),
  source: z.enum(["manual", "sync"]).nullable(),
  calendar_id: z.string().uuid().nullable(),
  missing_since: z.string().nullable(),
  slot: MEAL_SLOT.nullable(),
  servings: z.number().int().positive().nullable(),
  thumbnail_path: z.string().nullable(),
  board_name: z.string().nullable(),
  column_name: z.string().nullable(),
  series_id: z.string().uuid().nullish(),
});

export type AgendaRow = z.infer<typeof agendaRowSchema>;

function parts(iso: string, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

/** `2026-10-14` for the instant, on the calendar of `timeZone`. */
export function localDate(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `2026-10-14T09:00:00`, the wall-clock time of the instant in `timeZone`. */
export function localDateTime(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

function requireValue<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`agenda row misses ${what}`);
  return value;
}

/** All-day span from stored instants: UTC dates, exclusive end, null = one day. */
function allDaySpan(startsAt: string, endsAt: string | null) {
  const start = localDate(startsAt, "UTC");
  const end = endsAt ? localDate(endsAt, "UTC") : null;
  return { start, end: end !== null && end > start ? end : null };
}

/** The `meal_plans.position` default; the query layer replaces it with the stored value. */
export const DEFAULT_MEAL_POSITION = 1000;

/** A meal is a day-level item: all-day on its date, or on the date of the event it is attached to. */
function mealDay(row: AgendaRow, timeZone: string) {
  if (row.planned_on) return { start: row.planned_on, end: null, allDay: true };
  const startsAt = requireValue(row.starts_at, "starts_at");
  return { start: localDate(startsAt, row.all_day ? "UTC" : timeZone), end: null, allDay: true };
}

export function mapAgendaRow(row: AgendaRow, timeZone: string): AgendaItem {
  const base = { id: row.id, title: row.title, linkCount: row.link_count };

  // A day-bound item, or one that borrows its event's time (attached meal).
  const timeOf = () => {
    if (row.planned_on) return { start: row.planned_on, end: null, allDay: true };
    const startsAt = requireValue(row.starts_at, "starts_at");
    if (row.all_day) return { ...allDaySpan(startsAt, row.ends_at), allDay: true };
    return {
      start: localDateTime(startsAt, timeZone),
      end: row.ends_at ? localDateTime(row.ends_at, timeZone) : null,
      allDay: false,
    };
  };

  switch (row.kind) {
    case "event":
      return {
        ...base,
        ...timeOf(),
        kind: "event",
        source: requireValue(row.source, "source"),
        calendarId: requireValue(row.calendar_id, "calendar_id"),
        missingSince: row.missing_since,
        ...(row.series_id ? { recurring: true } : {}),
      };
    case "meal":
      return {
        ...base,
        ...mealDay(row, timeZone),
        kind: "meal",
        slot: requireValue(row.slot, "slot"),
        servings: requireValue(row.servings, "servings"),
        thumbnailPath: row.thumbnail_path,
        attached: row.planned_on === null,
        position: DEFAULT_MEAL_POSITION,
      };
    case "planned_card":
      return {
        ...base,
        start: requireValue(row.planned_on, "planned_on"),
        end: null,
        allDay: true,
        kind: "planned_card",
        board: requireValue(row.board_name, "board_name"),
        column: requireValue(row.column_name, "column_name"),
      };
    case "deadline":
      return {
        ...base,
        id: `deadline:${row.id}`,
        start: localDate(requireValue(row.starts_at, "starts_at"), timeZone),
        end: null,
        allDay: true,
        kind: "deadline",
      };
  }
}

const KIND_ORDER = { deadline: 0, planned_card: 1, event: 2, meal: 3 } as const;

/** Day first, all-day items before timed ones, then time, kind and title. */
export function compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
  return (
    a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) ||
    Number(b.allDay) - Number(a.allDay) ||
    a.start.localeCompare(b.start) ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}

export function mapAgendaRows(rows: unknown, timeZone: string): AgendaItem[] {
  return agendaRowSchema
    .array()
    .parse(rows)
    .map((row) => mapAgendaRow(row, timeZone))
    .sort(compareAgendaItems);
}
