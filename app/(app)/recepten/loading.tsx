import { BoardSkeleton } from "../_components/PageSkeleton";

// #170: same route-segment Suspense fallback story as app/(app)/te-doen/
// loading.tsx — see that file's comment and PageSkeleton.tsx.
export default function Loading() {
  return <BoardSkeleton />;
}
