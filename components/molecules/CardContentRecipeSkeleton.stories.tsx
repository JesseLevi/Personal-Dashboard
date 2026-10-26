// figma: node-id=4164:23681
import { StoryIntro } from "@/.ladle/story-kit";
import { CardContentRecipeSkeleton } from "./CardContentRecipeSkeleton";
import { Card } from "./Card";
import nl from "../../messages/nl.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card content recipe skeleton" } satisfies StoryDefault;

const label = nl.components.recipeImport.skeleton.loadingLabel;

// In the Card slot at the board's column content width (Figma Card 290px).
export const Overview = () => (
  <>
    <StoryIntro what="The placeholder shown while a recipe import is still running." note="CardContentRecipeSkeleton" />
    <div className="w-72.5">
      <Card>
        <CardContentRecipeSkeleton label={label} />
      </Card>
    </div>
  </>
);
