import { Suspense } from "react";
import { TeDoenPageStream } from "../TeDoenPageStream";
import { BoardSkeleton } from "../../_components/skeletons/BoardSkeleton";

// #95: the board switcher's explicit, shareable/bookmarkable URL (ticket's
// own requirement — board choice belongs in the URL, not client state). An
// id that doesn't resolve to one of the signed-in user's boards falls back
// to the favourite (board-data.ts), same as visiting `/te-doen` with none at
// all — see design/notes/TeDoenBoard.md.
//
// #170: same <Suspense>-around-TeDoenPageBody story as `/te-doen`'s own
// page.tsx — see that file's comment.
export default async function TeDoenBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ sort?: string; card?: string }>;
}) {
  const { boardId } = await params;
  const { sort, card } = await searchParams;
  return (
    <Suspense fallback={<BoardSkeleton variant="todo" />}>
      <TeDoenPageStream boardId={boardId} sortParam={sort} cardParam={card} />
    </Suspense>
  );
}
