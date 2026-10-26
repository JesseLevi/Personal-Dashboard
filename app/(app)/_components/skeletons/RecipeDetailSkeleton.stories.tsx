// figma: node-id=4164:26042 (Recept/Mobile) / 4164:26088 (Recept/Desktop)
import { RecipeDetailSkeleton } from "./RecipeDetailSkeleton";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Recipe detail skeleton" } satisfies StoryDefault;

// Stands in for AppShellNav's <main> (left padding + page-stack gap).
export const Default = () => (
  <div className="flex flex-col gap-page-stack pl-page-left">
    <RecipeDetailSkeleton />
  </div>
);
