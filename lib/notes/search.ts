// #231: shared query-threshold logic for the /notities search bar.
// Framework-free (no "server-only"/"use client"), same reasoning
// lib/notes/timestamp.ts's/lib/notes/sort.ts's own module comments give --
// notes-data.ts (server, decides board-vs-search branch) and
// NotitiesBoard.tsx (client, decides when to navigate and drives the
// fade animation) both need the exact same threshold, so it lives once
// here rather than being re-derived on either side.

/**
 * Minimum trimmed query length before a search actually runs. Below this,
 * the page stays on the normal kanban board -- no fetch, no UI change. 2,
 * not 1 or 3: a single character against an `ilike '%x%'` substring match
 * over every note's title + content_text returns a lot of near-random
 * matches for almost no typed intent, while 2 already narrows meaningfully
 * and still feels instant to type. No design source for this number --
 * the ticket explicitly left it to this ticket's own call, motivated here
 * and in the PR.
 */
export const NOTES_SEARCH_MIN_QUERY_LENGTH = 2;

/** Debounce before a keystroke turns into a `?q=` navigation -- 300ms, the same codebase default `IngredientSearchPanel.tsx`'s `SEARCH_DEBOUNCE_MS` already uses (no design source there either). */
export const NOTES_SEARCH_DEBOUNCE_MS = 300;

/**
 * Trims `rawQuery` and applies `NOTES_SEARCH_MIN_QUERY_LENGTH` -- returns
 * `""` (never searching) whenever the trimmed input doesn't reach the
 * threshold, otherwise the trimmed query. The single source both
 * `notes-data.ts` (server: board vs. search branch) and `NotitiesBoard.tsx`
 * (client: when to navigate, when the fade-in/out should fire) compare
 * against, so the two sides can never disagree on where the line is.
 */
export function effectiveNotesSearchQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  return trimmed.length >= NOTES_SEARCH_MIN_QUERY_LENGTH ? trimmed : "";
}
