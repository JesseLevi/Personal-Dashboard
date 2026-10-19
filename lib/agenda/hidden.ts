import type { AgendaItem, AgendaItemKind } from "@/lib/agenda/types";

// What this device hides in the Agenda (ADR-0040 §6): calendar ids and the fixed kinds
// meals, planned cards and deadlines. A cookie, so the first render is right; nothing is
// stored in the database.

export const AGENDA_HIDDEN_COOKIE = "agenda-hidden";

/** The kinds that are not events; they have no calendar to hide, so they are hidden by kind. */
export const HIDDEN_KINDS = ["meal", "planned_card", "deadline"] as const satisfies readonly AgendaItemKind[];

export type HiddenKind = (typeof HIDDEN_KINDS)[number];

export interface AgendaHidden {
  calendars: string[];
  kinds: HiddenKind[];
}

export const NOTHING_HIDDEN: AgendaHidden = { calendars: [], kinds: [] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Dots separate the entries: neither a uuid nor a kind holds one, and a cookie value needs no escaping.
const SEPARATOR = ".";

function isKind(value: string): value is HiddenKind {
  return (HIDDEN_KINDS as readonly string[]).includes(value);
}

/** Reads the cookie value; anything that is not a known kind or a uuid is dropped. */
export function parseHidden(value: string | undefined): AgendaHidden {
  const parts = (value ?? "").split(SEPARATOR);
  return {
    calendars: [...new Set(parts.filter((part) => UUID.test(part)))],
    kinds: HIDDEN_KINDS.filter((kind) => parts.includes(kind)),
  };
}

export function serializeHidden(hidden: AgendaHidden): string {
  return [...hidden.kinds, ...hidden.calendars].join(SEPARATOR);
}

export function isHidden(hidden: AgendaHidden, target: { calendar: string } | { kind: string }): boolean {
  return "calendar" in target
    ? hidden.calendars.includes(target.calendar)
    : isKind(target.kind) && hidden.kinds.includes(target.kind);
}

/** The same set with one calendar or kind shown or hidden. */
export function withVisibility(
  hidden: AgendaHidden,
  target: { calendar: string } | { kind: HiddenKind },
  visible: boolean,
): AgendaHidden {
  if ("calendar" in target) {
    const rest = hidden.calendars.filter((id) => id !== target.calendar);
    return { ...hidden, calendars: visible ? rest : [...rest, target.calendar] };
  }
  const rest = hidden.kinds.filter((kind) => kind !== target.kind);
  return { ...hidden, kinds: visible ? rest : HIDDEN_KINDS.filter((kind) => kind === target.kind || rest.includes(kind)) };
}

/** True when the item is hidden on this device: an event by its calendar, any other item by its kind. */
export function isItemHidden(item: AgendaItem, hidden: AgendaHidden): boolean {
  return item.kind === "event" ? hidden.calendars.includes(item.calendarId) : hidden.kinds.includes(item.kind);
}

/** Remembers the hidden set on this device; the server page reads it back to render without a flash. */
export function persistHidden(hidden: AgendaHidden): void {
  try {
    const value = serializeHidden(hidden);
    const age = value === "" ? 0 : 31536000;
    document.cookie = `${AGENDA_HIDDEN_COOKIE}=${value}; path=/; max-age=${age}; samesite=lax`;
  } catch {
    // Cookies blocked: everything shows again next time.
  }
}
