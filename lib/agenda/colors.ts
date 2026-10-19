import type { AgendaItem } from "@/lib/agenda/types";

/** The nine palette keys (ADR-0040): the suffixes of the `event-<colour>-*` tokens. */
export const AGENDA_COLORS = ["red", "orange", "amber", "green", "teal", "blue", "violet", "pink", "stone"] as const;

export type AgendaColor = (typeof AGENDA_COLORS)[number];

/** Fixed colours of the kinds that are not events (ADR-0040 §4). */
export const KIND_COLORS = { meal: "green", planned_card: "amber", deadline: "red" } as const satisfies Record<string, AgendaColor>;

/** Shown for an event whose calendar's colour is unknown (a calendar deleted while the page was open). */
export const FALLBACK_EVENT_COLOR: AgendaColor = "blue";

export function isAgendaColor(value: unknown): value is AgendaColor {
  return typeof value === "string" && (AGENDA_COLORS as readonly string[]).includes(value);
}

/** The colour a new calendar starts with: the one `used` holds least, first in palette order (mirrors `private.next_calendar_color`). */
export function nextFreeColor(used: readonly AgendaColor[]): AgendaColor {
  const count = (color: AgendaColor) => used.filter((candidate) => candidate === color).length;
  return AGENDA_COLORS.reduce((best, color) => (count(color) < count(best) ? color : best));
}

export function itemColor(item: AgendaItem): AgendaColor {
  return item.kind === "event" ? item.color : KIND_COLORS[item.kind];
}
