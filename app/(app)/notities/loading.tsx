import { BoardSkeleton } from "../_components/PageSkeleton";

// #230: same route-segment Suspense fallback story as app/(app)/recepten/
// loading.tsx / te-doen/loading.tsx -- see those files' comments and
// PageSkeleton.tsx.
export default function Loading() {
  return <BoardSkeleton />;
}
