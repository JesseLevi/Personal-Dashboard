import { BoardSkeleton } from "../../_components/skeletons/BoardSkeleton";

// Same fallback as `/te-doen`'s own loading.tsx.
export default function Loading() {
  return <BoardSkeleton variant="todo" />;
}
