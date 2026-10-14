import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getBoardIdForCard } from "@/lib/boards/queries";
import { EnterFromLoginSkeleton } from "./EnterFromLoginSkeleton";
import { TeDoenPageStream } from "./TeDoenPageStream";
import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

// #95: no boardId segment here — TeDoenPageBody/board-data.ts fall back to
// the user's favourite board, same behaviour this route always had (see
// design/notes/TeDoenBoard.md), now shared with the explicit
// `[boardId]` route below it.
//
// #170: TeDoenPageBody (the data-dependent subtree) is wrapped in its own
// <Suspense> here, nested inside AppShellNav's already-painted sidebar/
// header shell (app/(app)/layout.tsx doesn't await board data), so a board
// fetch never blocks the chrome.
//
// #223 follow-up: page-level `manifest` metadata links this route's own
// Web App Manifest (./manifest.webmanifest/route.ts) so "Add to Home
// Screen" from here installs a Te-Doen-specific shortcut instead of
// inheriting the root manifest. See design/notes/AppShell.md.
export const metadata: Metadata = {
  manifest: "/te-doen/manifest.webmanifest",
};

export default async function TeDoenPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; card?: string }>;
}) {
  const { sort, card } = await searchParams;
  // A link to one card (the Agenda's deadlines and planned cards): open it on its own board.
  if (card) {
    const boardId = await getBoardIdForCard(card);
    if (boardId) redirect(`/te-doen/${boardId}?card=${card}`);
  }
  return (
    <Suspense
      fallback={
        <EnterFromLoginSkeleton>
          <BoardSkeleton variant="todo" />
        </EnterFromLoginSkeleton>
      }
    >
      <TeDoenPageStream sortParam={sort} />
    </Suspense>
  );
}
