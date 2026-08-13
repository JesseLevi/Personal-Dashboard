// View-only note sorting for the #230 Sort dropdown (Figma "Knoppen" node
// 4067:19270's Sorteer button) -- same "sort never touches `position`, it
// only reorders an already-fetched array in memory" split lib/boards/sort.ts
// established (see that file's own header comment). Only two options are
// note-relevant per the ticket ("alleen notitie-relevante opties... met
// aangemaakdatum en alfabetisch") -- there is no priority/size axis on a
// note the way a Te-Doen card has. Framework-free, safe to import from both
// server (app/(app)/notities/notes-data.ts) and client (NotitiesBoard.tsx,
// for the dropdown's own option list) code.

export const NOTE_SORT_OPTIONS = ["createdAt", "alphabetical"] as const;
export type NoteSortOption = (typeof NOTE_SORT_OPTIONS)[number];

export function isNoteSortOption(value: string): value is NoteSortOption {
  return (NOTE_SORT_OPTIONS as readonly string[]).includes(value);
}

/**
 * Reorders one category's notes for display only -- `sort: null` (no
 * `?sort=` searchParam) returns `notes` unchanged, i.e. the manual/position
 * order the query already fetched. `Array.prototype.sort` is stable
 * (spec-guaranteed since ES2019), so ties within a sort key fall back to
 * that same position order rather than an arbitrary one. Generic over any
 * shape carrying `title`/`created_at` so it works against both
 * `NoteSummaryRow` (the real board) and a plain fixture (tests).
 */
export function sortNotesForView<T extends { title: string; created_at: string }>(
  notes: T[],
  sort: NoteSortOption | null,
): T[] {
  if (sort === null) return notes;
  const sorted = [...notes];
  switch (sort) {
    case "createdAt":
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case "alphabetical":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "nl"));
      break;
  }
  return sorted;
}
