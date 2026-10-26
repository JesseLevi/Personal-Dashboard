// design: Claude-designed on request (#318)
import { SourceLink } from "./SourceLink";
import nl from "../../../../messages/nl.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Source link" } satisfies StoryDefault;

const label = nl.components.recipeDetailPage.sourceLabel;

export const Default = () => <SourceLink url="https://www.leukerecepten.nl/recepten/pasta-pesto" label={label} />;

// A stored URL that is not https (or null) renders nothing.
export const NotShown = () => (
  <div className="flex flex-col gap-stack-sm">
    <SourceLink url="http://example.com/recept" label={label} />
    <SourceLink url={null} label={label} />
    <p className="text-sm font-semibold text-text-secondary">(geen bron getoond)</p>
  </div>
);
