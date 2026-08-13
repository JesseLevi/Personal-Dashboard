// Pure, framework-free three-tier timestamp classifier for a note card's
// `CardContentNote.timestamp` prop. #229 (design/notes/CardContentNote.md,
// "Date-formatting helper") specified the shape but deliberately did not
// build it, leaving it for "#230 of #231, wie het eerst landt" -- #230 is
// first.
//
// Three tiers, matching the fetched sample timestamps ("12:24"/"Gisteren"/
// "12-03-2026"/"10-03-2026"): today -> time-only, yesterday -> a literal
// word, older -> a full date. The "yesterday" word is deliberately NOT
// returned as a string here -- ADR-0007 (data-layer.md) puts every
// user-facing string in the next-intl catalogs, and this module stays
// framework-free (importable from both server and client code, same
// precedent as lib/boards/sort.ts) rather than importing next-intl. A
// discriminated result was chosen over the other option the ticket allowed
// (passing the already-translated word in as a parameter): this keeps the
// function's signature about *when*, not *what to render*, so a caller never
// has to translate a word it might not even use (two of three tiers need no
// translation at all), and it stays testable with zero i18n setup, matching
// every other lib/ pure helper in this codebase (nextPosition, sortCardsForView,
// deriveTitle). See design/notes/NotitiesBoard.md for the full comparison.
export type NoteTimestamp =
  | { tier: "today"; time: string }
  | { tier: "yesterday" }
  | { tier: "older"; date: string };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Classifies `isoTimestamp` (a note's `updated_at`) against `now`
 * (injectable for tests, defaults to the real clock) into one of three
 * tiers. Both are compared by the runtime's local calendar day, deliberately
 * not UTC -- "vandaag"/"gisteren" are calendar concepts for the person
 * looking at the screen, not the server, so this is meant to be called from
 * client code (NotitiesBoard.tsx renders it, "use client"). `time`/`date`
 * are fixed "HH:MM"/"dd-mm-yyyy" strings (the ticket's own literal spec),
 * not `Intl`-formatted against a locale -- this app has exactly one locale
 * today (`i18n/request.ts`) and the ticket names these two exact shapes, not
 * a locale-varying one.
 */
export function formatNoteTimestamp(isoTimestamp: string, now: Date = new Date()): NoteTimestamp {
  const date = new Date(isoTimestamp);

  if (isSameCalendarDay(date, now)) {
    return { tier: "today", time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return { tier: "yesterday" };
  }

  return {
    tier: "older",
    date: `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`,
  };
}
