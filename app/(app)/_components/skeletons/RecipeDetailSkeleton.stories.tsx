// figma: node-id=4164:26042 (Recept/Mobile) / 4164:26088 (Recept/Desktop)
import { RecipeDetailSkeleton } from "./RecipeDetailSkeleton";

// Stands in for AppShellNav's <main> (left padding + page-stack gap).
export const Default = () => (
  <div className="flex flex-col gap-page-stack pl-page-left">
    <RecipeDetailSkeleton />
  </div>
);
