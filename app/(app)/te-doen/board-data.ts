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
//
// #170: with an explicit `boardId`, `getBoardWithColumns(boardId)` doesn't
// depend on `boards` at all — only the *fallback* (stale/foreign id, or no
// id) does, since it needs the boards list to compute the favourite. So the
// two only run in `Promise.all()` when `boardId` is given; the no-id path
// stays sequential (favouriteId can't be known before `boards` resolves) and
// so does the fallback fetch itself. #168 made this safe to parallelize:
// both queries now share one cache()'d getAuthenticatedUserId() resolution
// instead of each paying their own auth round trip.

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

  let boards: BoardRow[];
  let board: BoardWithColumns | null;

  if (boardId) {
    [boards, board] = await Promise.all([getBoardsForUser(), getBoardWithColumns(boardId)]);
  } else {
    boards = await getBoardsForUser();
    board = null;
  }

  if (boards.length === 0) return { boards, board: null, sort };

  const favoriteId = boards.find((b) => b.is_favorite)?.id ?? boards[0].id;

  // No id, or `boardId` didn't resolve to one of this user's boards — both
  // land on the favourite, and both must wait for `boards` first, so this
  // leg stays sequential.
  if (!boardId || !board) {
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
