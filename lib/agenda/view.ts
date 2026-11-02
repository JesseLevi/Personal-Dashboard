export const AGENDA_VIEWS = ["day", "threeDay", "week", "month", "list"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_VIEW_COOKIE = "agenda-view";
export const DEFAULT_AGENDA_VIEW: AgendaView = "week";

export function isAgendaView(value: unknown): value is AgendaView {
  return typeof value === "string" && (AGENDA_VIEWS as readonly string[]).includes(value);
}

const WEEK_MIN_PX = 600;
const THREE_DAY_MIN_PX = 352;

/** What the planner can show at this width: "week" gives way to three days, then one; other views stay. `null` (not measured yet) keeps the choice. */
export function fitAgendaView(view: AgendaView, plannerWidthPx: number | null): AgendaView {
  if (view !== "week" || plannerWidthPx === null) return view;
  if (plannerWidthPx >= WEEK_MIN_PX) return "week";
  return plannerWidthPx >= THREE_DAY_MIN_PX ? "threeDay" : "day";
}

/** Remembers the chosen view on this device; the server page reads it back to render without a flash. */
export function persistAgendaView(view: AgendaView): void {
  try {
    document.cookie = `${AGENDA_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked: the view simply is not remembered.
  }
}
