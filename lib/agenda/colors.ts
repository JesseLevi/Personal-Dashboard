import type { AgendaItem } from "@/lib/agenda/types";

/** The nine palette keys (ADR-0040): the suffixes of the `event-<colour>-*` tokens. */
export const AGENDA_COLORS = ["red", "orange", "amber", "green", "teal", "blue", "violet", "pink", "stone"] as const;

export type AgendaColor = (typeof AGENDA_COLORS)[number];

/** Fixed colours of the kinds that are not events (ADR-0040 §4). */
export const KIND_COLORS = { meal: "green", planned_card: "amber", deadline: "red" } as const satisfies Record<string, AgendaColor>;

/** Stand-in until `calendars.color` exists: own events blue, imported events violet. */
export const SOURCE_COLORS = { manual: "blue", sync: "violet" } as const satisfies Record<string, AgendaColor>;

export function itemColor(item: AgendaItem): AgendaColor {
  return item.kind === "event" ? item.color : KIND_COLORS[item.kind];
}
