// View-only card sorting for the #95 Sort dropdown (Figma "Te doen/Desktop/
// SortOnClick", node 3877:6693). Deliberately separate from lib/boards/
// positioning.ts: sorting never touches `position` (the ticket's own "sort is
// a VIEW choice, not a mutation" instruction) — it only reorders the in-memory
// `cards` array a page request already fetched in position order. Framework-
// free, safe to import from both server (app/(app)/te-doen/board-data.ts) and
// client (TeDoenHeader.tsx, for the dropdown's own option list) code.

import { isPriority, isSize, type Priority } from "./enums";
import type { CardWithLabels } from "./types";

export const SORT_OPTIONS = ["createdAt", "priority", "size", "alphabetical"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export function isSortOption(value: string): value is SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value);
}

// Ticket-specified order "urgent > medium > mid > low". This schema's own
// `priority` enum only has low|medium|urgent (`mid` was dropped, `medium`
// took its color — see the kanban migration's own comment), so there is no
// `mid` rank to place; urgent-first/low-last is preserved.
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, medium: 1, low: 2 };
const UNKNOWN_PRIORITY_RANK = 3;

// S -> XL, the enum's own declared order (lib/boards/enums.ts) — Figma
// specifies no direction for "Grootte", so ascending is the least-surprising
// default. Cards without a size sort last.
const SIZE_RANK: Record<string, number> = { s: 0, m: 1, l: 2, xl: 3 };
const NO_SIZE_RANK = 4;

function priorityRank(priority: string): number {
  return isPriority(priority) ? PRIORITY_RANK[priority] : UNKNOWN_PRIORITY_RANK;
}

function sizeRank(size: string | null): number {
  if (size === null || !isSize(size)) return NO_SIZE_RANK;
  return SIZE_RANK[size];
}

/**
 * Reorders one column's cards for display only — `sort: null` (no `?sort=`
 * searchParam) returns `cards` unchanged, i.e. the manual/position order the
 * query already fetched. `Array.prototype.sort` is stable (guaranteed by the
 * spec since ES2019, and this codebase's Node/V8 runtime honors it), so
 * ties within a sort key fall back to that same position order rather than
 * an arbitrary one.
 */
export function sortCardsForView<T extends CardWithLabels>(
  cards: T[],
  sort: SortOption | null,
): T[] {
  if (sort === null) return cards;
  const sorted = [...cards];
  switch (sort) {
    case "createdAt":
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case "priority":
      sorted.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
      break;
    case "size":
      sorted.sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
      break;
    case "alphabetical":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "nl"));
      break;
  }
  return sorted;
}
