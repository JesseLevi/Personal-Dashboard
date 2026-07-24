// Pure client-side "apply a drag result to a board tree" helper (#96).
// @dnd-kit/react's own docs (Context7 /clauderic/dnd-kit,
// sortable-state-management.mdx) describe exactly one layer of this: render
// from local state (not directly from fetched data), only re-sync from the
// fetched data when no drag is active, revert to a snapshot on cancel —
// BoardView.tsx already does that internally for its own live-drag preview.
// TeDoenBoard.tsx needs the same pattern one level up, across the *async*
// moveCard() persistence: apply the move to its own local board copy the
// instant onMove fires, then revert to a pre-move snapshot if the server
// call fails. This is the pure "apply" half of that; TeDoenBoard.tsx owns
// the snapshot/revert state itself. Framework-free so it's unit-testable
// without a DOM — same shape as lib/boards/positioning.ts / sort.ts.

import type { BoardColumnWithCards, BoardWithColumns, CardWithLabels } from "./types";

export interface CardMove {
  itemId: string;
  toColumnId: string;
  toIndex: number;
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
 * rendered from this same board.
 */
export function applyCardMove(board: BoardWithColumns, move: CardMove): BoardWithColumns {
  const { itemId, toColumnId, toIndex } = move;

  let movedCard: CardWithLabels | undefined;
  const withoutCard: BoardColumnWithCards[] = board.columns.map((column) => {
    const index = column.cards.findIndex((card) => card.id === itemId);
    if (index === -1) return column;
    movedCard = column.cards[index];
    const cards = column.cards.slice();
    cards.splice(index, 1);
    return { ...column, cards };
  });

  if (!movedCard) return board;
  const card = movedCard;

  if (!withoutCard.some((column) => column.id === toColumnId)) return board;

  const columns: BoardColumnWithCards[] = withoutCard.map((column) => {
    if (column.id !== toColumnId) return column;
    const cards = column.cards.slice();
    const clampedIndex = Math.min(Math.max(toIndex, 0), cards.length);
    cards.splice(clampedIndex, 0, card);
    return { ...column, cards };
  });

  return { ...board, columns };
}
