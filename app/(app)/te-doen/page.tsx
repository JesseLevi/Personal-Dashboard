import { Suspense } from "react";
import { TeDoenPageBody } from "./TeDoenPageBody";
import { BoardSkeleton } from "../_components/PageSkeleton";

// #95: no boardId segment here — TeDoenPageBody/board-data.ts fall back to
// the user's favourite board, same behaviour this route always had (see
// design/notes/TeDoenBoard.md), now shared with the explicit
// `[boardId]` route below it.
//
// #170: TeDoenPageBody (the data-dependent subtree) is wrapped in its own
// <Suspense> here, nested inside AppShellNav's already-painted sidebar/
// header shell (app/(app)/layout.tsx doesn't await board data), so a board
// fetch never blocks the chrome.
export default async function TeDoenPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <TeDoenPageBody sortParam={sort} />
    </Suspense>
  );
}
