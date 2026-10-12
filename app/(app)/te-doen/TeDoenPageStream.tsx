import { Suspense } from "react";
import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";
import { EnterFromLoginSkeleton } from "./EnterFromLoginSkeleton";
import { loadTeDoenColumnCounts } from "./board-data";
import { TeDoenPageBody, type TeDoenPageBodyProps } from "./TeDoenPageBody";

// Stage 2 of the /te-doen loading sequence (design/notes/Skeletons.md): the
// outer fallback is the header-only skeleton; once the column counts are in,
// the exact-shaped skeleton covers the full board fetch.
export async function TeDoenPageStream({ boardId, sortParam }: TeDoenPageBodyProps) {
  const counts = await loadTeDoenColumnCounts(boardId);
  return (
    <Suspense
      fallback={
        <EnterFromLoginSkeleton>
          <BoardSkeleton variant="todo" counts={counts} />
        </EnterFromLoginSkeleton>
      }
    >
      <TeDoenPageBody boardId={boardId} sortParam={sortParam} />
    </Suspense>
  );
}
