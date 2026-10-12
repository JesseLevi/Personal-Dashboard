import { BoardSkeleton } from "../_components/skeletons/BoardSkeleton";
import { EnterFromLoginSkeleton } from "./EnterFromLoginSkeleton";

// Route-segment Suspense fallback, covering a hard navigation while
// TeDoenPageBody's fetch is in flight; the explicit <Suspense> in page.tsx
// usually catches client transitions first. See design/notes/Skeletons.md.
export default function Loading() {
  return (
    <EnterFromLoginSkeleton>
      <BoardSkeleton variant="todo" />
    </EnterFromLoginSkeleton>
  );
}
