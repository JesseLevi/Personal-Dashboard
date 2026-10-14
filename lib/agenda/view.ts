export const AGENDA_VIEWS = ["day", "threeDay", "week", "month", "list"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_VIEW_COOKIE = "agenda-view";
export const DEFAULT_AGENDA_VIEW: AgendaView = "week";

export function isAgendaView(value: unknown): value is AgendaView {
  return typeof value === "string" && (AGENDA_VIEWS as readonly string[]).includes(value);
}
