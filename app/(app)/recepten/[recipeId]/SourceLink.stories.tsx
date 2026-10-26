// design: Claude-designed on request (#318)
import { SourceLink } from "./SourceLink";
import nl from "../../../../messages/nl.json";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
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

export const Overview = () => (
  <div>
    <StoryIntro what="Link to the page a recipe was imported from. Only https links are shown." note="RecipeDetailPage" />
    <Specimens>
      <Specimen label="Shown" hint="A stored https URL">
        <SourceLink url="https://www.leukerecepten.nl/recepten/pasta-pesto" label={label} />
      </Specimen>
      <Specimen label="Not shown" hint="http or no URL renders nothing">
        <div className="flex flex-col gap-stack-sm">
          <SourceLink url="http://example.com/recept" label={label} />
          <SourceLink url={null} label={label} />
          <p className="text-sm font-semibold text-text-secondary">(nothing rendered above)</p>
        </div>
      </Specimen>
    </Specimens>
  </div>
);
