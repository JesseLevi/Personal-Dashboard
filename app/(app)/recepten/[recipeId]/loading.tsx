import { RecipeDetailSkeleton } from "../../_components/skeletons/RecipeDetailSkeleton";

// Route-segment Suspense fallback for the recipe detail page —
// design/notes/Skeletons.md.
export default function Loading() {
  return <RecipeDetailSkeleton />;
}
