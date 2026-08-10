import { BoardSkeleton } from "../_components/PageSkeleton";

// #170: automatic Suspense boundary for this route segment — shown while
// TeDoenPageBody's fetch is in flight on a hard navigation. The explicit
// <Suspense> around <TeDoenPageBody> (page.tsx) usually catches the
// suspension first on client transitions; this file covers the segment-level
// case Next's file convention expects regardless. See PageSkeleton.tsx.
export default function Loading() {
  return <BoardSkeleton />;
}
