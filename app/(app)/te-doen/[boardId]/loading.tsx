import { BoardSkeleton } from "../../_components/PageSkeleton";

// #170: same route-segment Suspense fallback as `/te-doen`'s own loading.tsx
// — see that file's comment.
export default function Loading() {
  return <BoardSkeleton />;
}
