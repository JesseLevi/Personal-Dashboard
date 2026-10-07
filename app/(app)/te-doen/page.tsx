import type { Metadata } from "next";
import { Suspense } from "react";
import { TeDoenPageBody } from "./TeDoenPageBody";
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
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  return (
    <Suspense fallback={<BoardSkeleton variant="todo" />}>
      <TeDoenPageBody sortParam={sort} />
    </Suspense>
  );
}
