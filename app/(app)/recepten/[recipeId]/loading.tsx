import { RecipeDetailSkeleton } from "../../_components/PageSkeleton";

// #170: route-segment Suspense fallback for the recipe detail page — see
// app/(app)/te-doen/loading.tsx for the general story, PageSkeleton.tsx for
// why this reuses `Card` rather than a bespoke skeleton.
export default function Loading() {
  return <RecipeDetailSkeleton />;
}
