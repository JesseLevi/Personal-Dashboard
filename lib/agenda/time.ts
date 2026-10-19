import { localDate } from "@/lib/agenda/map";
import type { AgendaView } from "@/lib/agenda/view";
import type { AgendaSpan } from "@/lib/ui/agenda-calendar";

// Pure date helpers for the Agenda page. Atlas has no per-user time zone yet
// (ADR-0037), so every wall-clock time is read and written in one fixed zone.
// The calendar shows wall-clock strings as they come; its callbacks append the
// browser's offset, which is dropped here and replaced by this zone's.
export const AGENDA_TIME_ZONE = "Europe/Amsterdam";

const DAY_MS = 86_400_000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

export function zoneOffsetMs(utcMs: number, timeZone: string): number {
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
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant (UTC ISO) at which `timeZone`'s wall clock reads `local`; any offset on `local` is ignored. */
export function wallClockToUtc(local: string, timeZone: string = AGENDA_TIME_ZONE): string {
  const m = LOCAL.exec(local);
  if (!m) throw new Error("invalid local date-time");
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  const first = guess - zoneOffsetMs(guess, timeZone);
  return new Date(guess - zoneOffsetMs(first, timeZone)).toISOString();
}

/** `YYYY-MM-DD` plus `days`. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The first day of the month `months` away from `date`'s month. */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

/** The ISO 8601 week number (1-53) of `date`: weeks start on Monday and week 1 holds the year's first Thursday. */
export function isoWeek(date: string): number {
  const thursday = addDays(startOfWeek(date), 3);
  const jan1 = Date.UTC(Number(thursday.slice(0, 4)), 0, 1);
  return Math.floor((Date.parse(`${thursday}T00:00:00Z`) - jan1) / (7 * DAY_MS)) + 1;
}

/** `date` as the browser's local calendar day, `YYYY-MM-DD`. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const AGENDA_DEFAULT_SCROLL_HOUR = 7;

/**
 * The hour a time grid opens on: one hour before `now` when the shown range
 * holds today (the grid and its now line follow the browser's clock), else 07:00.
 */
export function initialScrollHour(range: { start: string; end: string }, now: Date): number {
  const today = localDay(now);
  return today >= range.start && today < range.end ? Math.max(0, now.getHours() - 1) : AGENDA_DEFAULT_SCROLL_HOUR;
}

/** Hour labels this close to now (minutes) give way to the now label. */
export const NOW_LABEL_CLEARANCE_MINUTES = 15;

/** Whether the axis label of the slot starting at `slotMinutes` after midnight lies under the now label. */
export function isUnderNowLabel(slotMinutes: number, now: Date): boolean {
  return Math.abs(slotMinutes - (now.getHours() * 60 + now.getMinutes())) <= NOW_LABEL_CLEARANCE_MINUTES;
}

/** Today's date in the Agenda zone. */
export function todayInAgendaZone(now: Date = new Date()): string {
  return localDate(now.toISOString(), AGENDA_TIME_ZONE);
}

/** The days the (effective) view shows: `[start, end)` as dates. */
export function visibleRange(view: AgendaView, date: string): { start: string; end: string } {
  switch (view) {
    case "day":
      return { start: date, end: addDays(date, 1) };
    case "threeDay":
      return { start: date, end: addDays(date, 3) };
    case "week":
    case "list": {
      const start = startOfWeek(date);
      return { start, end: addDays(start, 7) };
    }
    case "month": {
      const start = `${date.slice(0, 7)}-01`;
      return { start, end: addMonths(start, 1) };
    }
  }
}

/** The loaded window around `date`: its month plus a week each side, which covers every view's range. */
export function loadWindow(date: string): { from: string; to: string } {
  const first = `${date.slice(0, 7)}-01`;
  return { from: addDays(first, -7), to: addDays(addMonths(first, 1), 7) };
}

/** The date after stepping the view one page back (-1) or forward (1). */
export function stepDate(view: AgendaView, date: string, direction: 1 | -1): string {
  switch (view) {
    case "day":
      return addDays(date, direction);
    case "threeDay":
      return addDays(date, 3 * direction);
    case "week":
    case "list":
      return addDays(date, 7 * direction);
    case "month":
      return addMonths(date, direction);
  }
}

/** A calendar span (wall clock, any offset) as the UTC instants the database stores. All-day: UTC midnights, exclusive end. */
export function spanToUtc(span: AgendaSpan, timeZone: string = AGENDA_TIME_ZONE) {
  if (span.allDay) {
    const start = span.start.slice(0, 10);
    const end = span.end && span.end.slice(0, 10) > start ? span.end.slice(0, 10) : addDays(start, 1);
    return { startsAt: `${start}T00:00:00.000Z`, endsAt: `${end}T00:00:00.000Z`, allDay: true };
  }
  const startsAt = wallClockToUtc(span.start, timeZone);
  const endsAt = span.end ? wallClockToUtc(span.end, timeZone) : new Date(Date.parse(startsAt) + 3_600_000).toISOString();
  return { startsAt, endsAt, allDay: false };
}
