export type ProgressColumn = { position: number; cardCount: number; isDone?: boolean };

/**
 * Cards and done cards of a board. Done columns are the ones flagged `isDone`
 * when any column carries the flag, otherwise the last column by position.
 */
export function boardProgress(columns: readonly ProgressColumn[]): { total: number; done: number } {
  const total = columns.reduce((sum, column) => sum + column.cardCount, 0);
  if (columns.length === 0) return { total, done: 0 };

  let doneColumns: readonly ProgressColumn[];
  if (columns.some((column) => column.isDone !== undefined)) {
    doneColumns = columns.filter((column) => column.isDone === true);
  } else {
    const lastPosition = Math.max(...columns.map((column) => column.position));
    doneColumns = columns.filter((column) => column.position === lastPosition);
  }
  return { total, done: doneColumns.reduce((sum, column) => sum + column.cardCount, 0) };
}

/**
 * Whether a card's column counts as done: the `isDone` flag when the board's columns carry it, otherwise the
 * last column by position (same rule as `boardProgress`). Switching to the flag is passing `isDone`.
 */
export function isDoneColumn(
  column: { position: number; isDone?: boolean },
  boardPositions: readonly number[],
): boolean {
  if (column.isDone !== undefined) return column.isDone;
  return boardPositions.length > 0 && column.position === Math.max(...boardPositions);
}
