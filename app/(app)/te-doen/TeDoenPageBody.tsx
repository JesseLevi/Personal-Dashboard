import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/organisms/PageHeader";
import { loadTeDoenPageData } from "./board-data";
import { TeDoenHeader } from "./TeDoenHeader";
import { TeDoenBoard } from "./TeDoenBoard";
import { createBoard, renameBoard, toggleBoardFavorite } from "./actions";

// Shared Server Component body for both `/te-doen` (page.tsx, no boardId —
// falls back to the favourite) and `/te-doen/[boardId]` (page.tsx, explicit
// id) — #95 introduced the second route; both are thin wrappers around this
// file so the fetch/empty-state/composition logic isn't duplicated. Not
// itself a route file, so it can stay a plain async Server Component
// composed into either page (same shape `AppShellNav.tsx` already used for
// cross-page composition).
export interface TeDoenPageBodyProps {
  boardId?: string;
  sortParam?: string;
}

export async function TeDoenPageBody({ boardId, sortParam }: TeDoenPageBodyProps) {
  const t = await getTranslations("components.pageHeader.todo");
  const { boards, board, sort } = await loadTeDoenPageData(boardId, sortParam);

  // Shouldn't happen (the seed trigger guarantees a default board per user)
  // but stays reachable once board deletion ships — see TeDoenBoard.md.
  if (!board) {
    return (
      <>
        <PageHeader title={t("emptyBoardTitle")} />
        <p className="text-base text-text-secondary">{t("emptyBoardBody")}</p>
      </>
    );
  }

  return (
    <>
      <TeDoenHeader
        boards={boards}
        board={board}
        sort={sort}
        onCreateBoard={createBoard}
        onRenameBoard={renameBoard}
        onToggleFavorite={toggleBoardFavorite}
      />
      {/* Sorting is a view-only choice (lib/boards/sort.ts) — when active the
          on-screen order no longer matches `position`, so dragging is
          disabled rather than letting a drop write a misleading position
          against what the user actually sees. See TeDoenBoard.md for the
          full reasoning #96 (drag persistence) must inherit. */}
      <TeDoenBoard board={board} dragDisabled={sort !== null} />
    </>
  );
}
