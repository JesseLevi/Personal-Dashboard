export const AGENDA_VIEWS = ["day", "threeDay", "week", "month", "list"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_VIEW_COOKIE = "agenda-view";
export const DEFAULT_AGENDA_VIEW: AgendaView = "week";

export function isAgendaView(value: unknown): value is AgendaView {
  return typeof value === "string" && (AGENDA_VIEWS as readonly string[]).includes(value);
}

/** Remembers the chosen view on this device; the server page reads it back to render without a flash. */
export function persistAgendaView(view: AgendaView): void {
  try {
    document.cookie = `${AGENDA_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked: the view simply is not remembered.
  }
}
