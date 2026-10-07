import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

// Route-segment Suspense fallback — see recepten/loading.tsx and
// design/notes/Skeletons.md.
export default function Loading() {
  return <BoardSkeleton variant="notes" />;
}
