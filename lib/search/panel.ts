import { isTypingTarget, type ShortcutEvent } from "@/lib/agenda/shortcuts";
import type { SearchType } from "@/lib/search/merge";
import type { SearchResponse, SearchResult } from "@/lib/search/query";

/** What the search panel needs from `searchAllAction`; a stable reference, it is a dependency of the debounce effect. */
export type SearchPanelAction = (
  q: string,
) => Promise<{ success: true; data: SearchResponse } | { success: false; error: string }>;

export const SEARCH_PANEL_DEBOUNCE_MS = 300;

/** ⌘K / Ctrl+K opens the panel, except while typing, with a panel open (`blocked`) or mid-composition. */
export function isSearchShortcut(event: ShortcutEvent, blocked: boolean): boolean {
  if (blocked || event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return false;
  if (event.metaKey === event.ctrlKey) return false;
  return !isTypingTarget(event.target);
}

export type SearchGroup = { type: SearchType; items: SearchResult[] };

/** Groups by type, in the order each type first shows up (the backend's rank), so the best match leads. */
export function groupResults(results: SearchResult[]): SearchGroup[] {
  const groups = new Map<SearchType, SearchResult[]>();
  for (const result of results) {
    const items = groups.get(result.type);
    if (items) items.push(result);
    else groups.set(result.type, [result]);
  }
  return [...groups].map(([type, items]) => ({ type, items }));
}

/** The results in the order they are shown (and walked with the arrow keys). */
export const flattenGroups = (groups: SearchGroup[]): SearchResult[] => groups.flatMap((group) => group.items);

/** The row an arrow key moves to, wrapping at both ends; null for any other key or an empty list. */
export function moveActive(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** The calm "Slim zoeken staat uit" line: only when the answer came from keywords and the member could switch it on. */
export const showSmartSearchHint = (mode: SearchResponse["mode"], canEnableSmart: boolean): boolean =>
  mode === "keyword" && canEnableSmart;
