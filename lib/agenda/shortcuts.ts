/** What a key does on the Agenda page; `N` opens quick add (ADR-0041). */
export type AgendaShortcut = "new" | "today" | "day" | "week" | "month" | "list" | "previous" | "next" | "tray";

const SHORTCUT_KEYS: Readonly<Record<string, AgendaShortcut>> = {
  n: "new",
  t: "today",
  d: "day",
  w: "week",
  m: "month",
  l: "list",
  p: "tray",
  arrowleft: "previous",
  arrowright: "next",
};

/** The overview in the ⋯ menu, in display order. */
export const AGENDA_SHORTCUT_KEYS: ReadonlyArray<{ shortcut: AgendaShortcut; keys: string }> = [
  { shortcut: "new", keys: "N" },
  { shortcut: "today", keys: "T" },
  { shortcut: "day", keys: "D" },
  { shortcut: "week", keys: "W" },
  { shortcut: "month", keys: "M" },
  { shortcut: "list", keys: "L" },
  { shortcut: "previous", keys: "←" },
  { shortcut: "next", keys: "→" },
  { shortcut: "tray", keys: "P" },
];

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  target: unknown;
}

/** A field the user types in: a shortcut must not fire there. */
export function isTypingTarget(target: unknown): boolean {
  const { tagName, isContentEditable } = (target ?? {}) as TargetLike;
  return isContentEditable === true || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

/** The shortcut a key press means, or null when it is not one or must be left alone (typing, a modifier, an open panel or popover). */
export function agendaShortcut(event: ShortcutEvent, blocked: boolean): AgendaShortcut | null {
  if (blocked || event.defaultPrevented || event.isComposing) return null;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  if (isTypingTarget(event.target)) return null;
  return SHORTCUT_KEYS[event.key.toLowerCase()] ?? null;
}
