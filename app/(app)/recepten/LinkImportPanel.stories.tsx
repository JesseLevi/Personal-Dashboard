// figma: node-id=4164:23722 (+4164:23777 mobile)
import { LinkImportPanel } from "./LinkImportPanel";
import type { ActionResult } from "@/lib/recipes/types";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Link import panel" } satisfies StoryDefault;

// Dev-only mock action — LinkImportPanel never imports the real "use server"
// module itself, same precedent as CategoryPanel.stories.tsx.
async function mockStartImport(categoryId: string, url: string): Promise<ActionResult<{ recipeId: string }>> {
  console.log("startRecipeImport", categoryId, url);
  return { success: true, data: { recipeId: "new-recipe" } };
}

// `min-h-screen` wrapper for the same reason as CategoryPanel.stories.tsx:
// the panel is `position: fixed`, so without it the screenshot crop collapses.
// Both shapes come from the same markup via `md:` classes; the gate baselines
// the desktop side panel, the mobile pull-up is checked at a phone viewport
// (design/notes/LinkImportPanel.md).
export const Empty = () => (
  <div className="min-h-screen">
    <LinkImportPanel open onClose={() => {}} categoryId="category-1" onStartImport={mockStartImport} />
  </div>
);

// The panel is `position: fixed`, so the intro sits in the dimmed area beside it.
export const Overview = () => (
  <div className="min-h-screen">
    <StoryIntro
      what="Side panel on desktop, pull-up on mobile, to import a recipe by pasting a link. Resize to see both shapes."
      note="LinkImportPanel"
    />
    <LinkImportPanel open onClose={() => {}} categoryId="category-1" onStartImport={mockStartImport} />
  </div>
);
