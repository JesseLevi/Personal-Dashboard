import { MAX_SUBTASKS_PER_CARD } from "@/lib/boards/schemas";
import type { SubtaskRow } from "@/lib/boards/types";

export const SUBTASK_TITLE_MAX = 200;

/** Open subtasks first, then done ones; each group keeps its position order. */
export function splitSubtasks<T extends Pick<SubtaskRow, "done" | "position">>(
  rows: readonly T[],
): { open: T[]; done: T[] } {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  return { open: sorted.filter((row) => !row.done), done: sorted.filter((row) => row.done) };
}

/** One title per non-empty line of pasted text, trimmed and cut to the title limit. */
export function splitPastedTitles(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, SUBTASK_TITLE_MAX))
    .filter((line) => line !== "");
}

/** The titles that still fit under the per-card cap. */
export function titlesThatFit(titles: readonly string[], existingCount: number): string[] {
  return titles.slice(0, Math.max(0, MAX_SUBTASKS_PER_CARD - existingCount));
}

/** The column "Alles af" offers: the board's first done column, unless the card is already in a done one. */
export function doneColumnOffer<T extends { id: string; isDone?: boolean }>(
  columns: readonly T[],
  currentColumnId: string,
): T | null {
  const doneColumns = columns.filter((column) => column.isDone);
  if (doneColumns.length === 0 || doneColumns.some((column) => column.id === currentColumnId)) return null;
  return doneColumns[0];
}

/** Gap used past either end of a group, like cards.position. */
export const SUBTASK_POSITION_STEP = 1000;

/**
 * The position for a row dropped at `index` among the other rows of its group.
 * `others` are those rows' positions, ascending, without the moved row itself.
 * Midpoint between the new neighbours; the neighbour -/+ 1000 at either end.
 */
export function positionForIndex(others: readonly number[], index: number): number {
  const before = index > 0 ? others[Math.min(index, others.length) - 1] : undefined;
  const after = index < others.length ? others[Math.max(index, 0)] : undefined;
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + SUBTASK_POSITION_STEP;
  if (after !== undefined) return after - SUBTASK_POSITION_STEP;
  return 0;
}
