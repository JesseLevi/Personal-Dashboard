import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

// Route-segment Suspense fallback; the same skeleton is the explicit
// <Suspense> fallback in page.tsx. See design/notes/Skeletons.md.
export default function Loading() {
  return <BoardSkeleton variant="recipes" />;
}
