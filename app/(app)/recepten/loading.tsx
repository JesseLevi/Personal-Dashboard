import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";

// Route-segment fallback: header-only skeleton, same as the outer <Suspense> in
// page.tsx (counts arrive in stage 2). See design/notes/Skeletons.md.
export default function Loading() {
  return <BoardSkeleton variant="recipes" />;
}
