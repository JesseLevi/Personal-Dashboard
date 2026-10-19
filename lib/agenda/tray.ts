export const AGENDA_TRAY_COOKIE = "agenda-tray";
export type AgendaTray = "open" | "closed";
export const DEFAULT_AGENDA_TRAY: AgendaTray = "closed";

export function isAgendaTray(value: unknown): value is AgendaTray {
  return value === "open" || value === "closed";
}

/** Remembers whether the plan tray is open on this device; the server page reads it back to render without a flash. */
export function persistAgendaTray(tray: AgendaTray): void {
  try {
    document.cookie = `${AGENDA_TRAY_COOKIE}=${tray}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked: the tray simply starts closed next time.
  }
}
