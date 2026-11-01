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
