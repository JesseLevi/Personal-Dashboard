// Pure client-side "apply a drag result to a column list" helper (#96,
// generalized #155). @dnd-kit/react's own docs (Context7 /clauderic/dnd-kit,
// sortable-state-management.mdx) describe exactly one layer of this: render
// from local state (not directly from fetched data), only re-sync from the
// fetched data when no drag is active, revert to a snapshot on cancel —
// BoardView.tsx already does that internally for its own live-drag preview.
// TeDoenBoard.tsx (and now ReceptenBoard.tsx, #155) need the same pattern
// one level up, across the *async* moveCard()/moveRecipe() persistence:
// apply the move to a local copy the instant onMove fires, then revert to a
// pre-move snapshot if the server call fails. This is the pure "apply" half
// of that; the board component itself owns the snapshot/revert state.
// Framework-free so it's unit-testable without a DOM — same shape as
// lib/boards/positioning.ts / sort.ts.

import type { BoardColumnWithCards, BoardWithColumns, CardWithLabels } from "./types";

export interface CardMove {
  itemId: string;
  toColumnId: string;
  toIndex: number;
}

// #155: te-doen's cards and recepten's recipes both need this exact
// algorithm, but each column type stores its items under a different key
// (`cards` vs `recipes`) — that key name, not just the item/column shapes,
// is what genuinely varies between callers. Parameterizing over the key
// name (`itemsKey`, a `keyof TColumn` whose value is `TItem[]`) generalizes
// over both without either caller reaching into a mismatched field, and
// without changing `applyCardMove`'s own two-argument call shape below
// (tests/boards-optimistic.test.ts keeps calling it unchanged). Operates on
// a bare column array, not a "board" wrapper object — te-doen's board has
// one (`BoardWithColumns.columns`), recepten's category list doesn't (a
// recipe category IS the column, there's no further wrapper), so the board
// component on each side is the one that (un)wraps its own shape; see
// applyCardMove below and ReceptenBoard.tsx.
export function applyItemMove<
  TItem extends { id: string },
  TKey extends string,
  TColumn extends { id: string } & Record<TKey, TItem[]>,
>(columns: TColumn[], move: CardMove, itemsKey: TKey): TColumn[] {
  const { itemId, toColumnId, toIndex } = move;

  let movedItem: TItem | undefined;
  const withoutItem: TColumn[] = columns.map((column) => {
    const items = column[itemsKey];
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return column;
    movedItem = items[index];
    const nextItems = items.slice();
    nextItems.splice(index, 1);
    return { ...column, [itemsKey]: nextItems } as TColumn;
  });

  if (!movedItem) return columns;
  const item = movedItem;

  if (!withoutItem.some((column) => column.id === toColumnId)) return columns;

  const result: TColumn[] = withoutItem.map((column) => {
    if (column.id !== toColumnId) return column;
    const items = column[itemsKey].slice();
    const clampedIndex = Math.min(Math.max(toIndex, 0), items.length);
    items.splice(clampedIndex, 0, item);
    return { ...column, [itemsKey]: items } as TColumn;
  });

  return result;
}

/**
 * Returns a new board with the card `itemId` removed from wherever it
 * currently lives and re-inserted into `toColumnId` at `toIndex` (clamped to
 * that column's remaining card count after removal) — the same "remove, then
 * insert among the siblings" semantics `moveCard`
 * (app/(app)/te-doen/actions.ts) uses server-side, so the optimistic order
 * matches what the server will persist. Unaffected columns/cards keep their
 * original object identity. Returns `board` unchanged (no-op) if `itemId`
 * isn't found on the board or `toColumnId` doesn't name one of its columns —
 * defensive only, BoardView only ever reports moves for items/columns it
 * rendered from this same board. Thin wrapper around the generic
 * `applyItemMove` above, keyed on `"cards"` — see that function's own
 * comment for why the key is the one thing this wrapper still has to name.
 */
export function applyCardMove(board: BoardWithColumns, move: CardMove): BoardWithColumns {
  const columns = applyItemMove<CardWithLabels, "cards", BoardColumnWithCards>(
    board.columns,
    move,
    "cards",
  );
  return columns === board.columns ? board : { ...board, columns };
}
