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
