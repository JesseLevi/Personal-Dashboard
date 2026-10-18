import { compareMeals } from "@/lib/agenda/meals";
import type { AgendaItem } from "@/lib/agenda/types";

/** The slice of FullCalendar's `EventInput` the Agenda uses; keeps this module free of the library. */
export interface AgendaEventInput {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  display: "auto" | "block";
  startEditable: boolean;
  durationEditable: boolean;
  extendedProps: { item: AgendaItem };
}

/** Which gestures an item allows. Synced events and deadlines are fixed; all-day items and cards/meals keep their length. */
export function itemEditability(item: AgendaItem): { move: boolean; resize: boolean } {
  switch (item.kind) {
    case "event":
      return { move: item.source === "manual", resize: item.source === "manual" && !item.allDay };
    case "meal":
    case "planned_card":
      return { move: true, resize: false };
    case "deadline":
      return { move: false, resize: false };
  }
}

export function toEventInput(item: AgendaItem): AgendaEventInput {
  const { move, resize } = itemEditability(item);
  return {
    id: item.id,
    title: item.title,
    start: item.start,
    ...(item.end ? { end: item.end } : {}),
    allDay: item.allDay,
    display: "block",
    startEditable: move,
    durationEditable: resize,
    extendedProps: { item },
  };
}

/**
 * What FullCalendar hands the `eventOrder` function: a flat object of the
 * event's extended props (so `item`) plus `start` and `duration` in
 * milliseconds and `allDay` as 0 or 1.
 */
export interface EventOrderSubject {
  allDay: number | boolean;
  start: number;
  duration: number;
  title?: string;
  item?: unknown;
}

const ALL_DAY_KIND_ORDER: Record<AgendaItem["kind"], number> = { deadline: 0, planned_card: 1, event: 2, meal: 3 };

/**
 * Order inside one day: all-day items first (deadlines, planned cards, events,
 * then meals by moment and position), then by start, longest first, and title.
 */
export function compareEventOrder(a: EventOrderSubject, b: EventOrderSubject): number {
  const allDay = Boolean(a.allDay);
  if (allDay !== Boolean(b.allDay)) return allDay ? -1 : 1;
  const itemA = a.item as AgendaItem | undefined;
  const itemB = b.item as AgendaItem | undefined;
  if (allDay && itemA && itemB) {
    const byKind = ALL_DAY_KIND_ORDER[itemA.kind] - ALL_DAY_KIND_ORDER[itemB.kind];
    if (byKind !== 0) return byKind;
    if (itemA.kind === "meal" && itemB.kind === "meal") return compareMeals(itemA, itemB);
  }
  return a.start - b.start || b.duration - a.duration || (a.title ?? "").localeCompare(b.title ?? "");
}

export function toEventInputs(items: AgendaItem[]): AgendaEventInput[] {
  return items.map(toEventInput);
}

export interface AgendaSpan {
  start: string;
  end: string | null;
  allDay: boolean;
}

/** An all-day span is reported as dates (`YYYY-MM-DD`); a timed one is passed through. */
export function normalizeSpan(span: AgendaSpan): AgendaSpan {
  if (!span.allDay) return span;
  const day = (s: string) => s.slice(0, 10);
  return { allDay: true, start: day(span.start), end: span.end ? day(span.end) : null };
}

/** Marks the plan drawer: an item dragged from the grid and dropped on it is taken off the calendar. */
export const AGENDA_TRAY_ATTRIBUTE = "data-agenda-tray";

/** The time grid is one lane of `AGENDA_SLOTS_PER_DAY` slots per day (no min/max time). */
export const AGENDA_SLOT_MINUTES = 30;
export const AGENDA_SLOTS_PER_DAY = (24 * 60) / AGENDA_SLOT_MINUTES;
/** Events and drag-selections snap to this; a click selects a whole slot. */
export const AGENDA_SNAP_MINUTES = 15;
/** A timed item shorter than this shows its title and start time on one line. */
export const AGENDA_SHORT_MINUTES = 45;

/** `09:05`: the 24-hour clock time of a date in the browser's zone, as the grid labels it. */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Whether a timed span is shorter than `minutes` (default `AGENDA_SHORT_MINUTES`). An open end counts as long: FullCalendar gives it an hour. */
export function isShortSpan(start: Date | null, end: Date | null, minutes: number = AGENDA_SHORT_MINUTES): boolean {
  if (!start || !end) return false;
  return end.getTime() - start.getTime() < minutes * 60_000;
}

/**
 * A click without drag selects one snap (15 minutes): widen it to the whole slot,
 * start floored to the slot boundary in the browser's zone. Longer selections and
 * all-day spans return null and stay as dragged.
 */
export function slotForSingleSnap(span: AgendaSpan, snapMinutes: number, slotMinutes: number): { start: Date; end: Date } | null {
  if (span.allDay || !span.end) return null;
  const start = new Date(span.start);
  const length = new Date(span.end).getTime() - start.getTime();
  if (length !== snapMinutes * 60_000) return null;
  start.setMinutes(Math.floor(start.getMinutes() / slotMinutes) * slotMinutes, 0, 0);
  return { start, end: new Date(start.getTime() + slotMinutes * 60_000) };
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The slot of a day lane under a pointer: full lane width, one slot high. Clamped to the lane. */
export function slotBox(lane: Box, pointerY: number, slots: number = AGENDA_SLOTS_PER_DAY): Box {
  const height = lane.height / slots;
  const index = Math.min(slots - 1, Math.max(0, Math.floor((pointerY - lane.top) / height)));
  return { top: lane.top + index * height, left: lane.left, width: lane.width, height };
}

/** The part of `box` inside `clip`, or null when they do not overlap. */
export function clipBox(box: Box, clip: Box): Box | null {
  const top = Math.max(box.top, clip.top);
  const left = Math.max(box.left, clip.left);
  const bottom = Math.min(box.top + box.height, clip.top + clip.height);
  const right = Math.min(box.left + box.width, clip.left + clip.width);
  return bottom > top && right > left ? { top, left, width: right - left, height: bottom - top } : null;
}
