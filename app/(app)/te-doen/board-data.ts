import "server-only";
import { getBoardsForUser, getBoardWithColumns } from "@/lib/boards/queries";
import { isSortOption, sortCardsForView, type SortOption } from "@/lib/boards/sort";
import type { BoardRow, BoardWithColumns } from "@/lib/boards/types";

// #95: resolves "the active board" for a `/te-doen` request, shared by both
// page.tsx (no boardId) and [boardId]/page.tsx. An explicit `boardId` wins if
// it still resolves to one of the signed-in user's boards; otherwise (no id,
// or a stale/foreign one — e.g. a bookmark to a since-deleted board) this
// falls back to the favourite, same "favourite = default" behaviour
// design/notes/TeDoenBoard.md already documented pre-#95, just reachable from
// two routes now instead of one.

export interface TeDoenPageData {
  boards: BoardRow[];
  board: BoardWithColumns | null;
  sort: SortOption | null;
}

export async function loadTeDoenPageData(
  boardId: string | undefined,
  sortParam: string | undefined,
): Promise<TeDoenPageData> {
  // An invalid/typo'd `?sort=` is treated as "no sort" (manual/position
  // order) rather than a 400 — same "never crash on a bad query string"
  // posture as getBoardWithColumns's own boardId guard.
  const sort = sortParam && isSortOption(sortParam) ? sortParam : null;

  const boards = await getBoardsForUser();
  if (boards.length === 0) return { boards, board: null, sort };

  const favoriteId = boards.find((b) => b.is_favorite)?.id ?? boards[0].id;
  const targetId = boardId ?? favoriteId;

  let board = await getBoardWithColumns(targetId);
  if (!board && boardId) {
    board = await getBoardWithColumns(favoriteId);
  }

  // Sorting is a VIEW choice (lib/boards/sort.ts) — reorders each column's
  // already-fetched `cards` array in memory, never rewrites `position`.
  if (board) {
    board = {
      ...board,
      columns: board.columns.map((column) => ({
        ...column,
        cards: sortCardsForView(column.cards, sort),
      })),
    };
  }

  return { boards, board, sort };
}
