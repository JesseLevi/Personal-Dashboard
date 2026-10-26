// figma: node-id=3695:3941
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { CardContentStep } from "./CardContentStep";
import { Card } from "./Card";
import { Step } from "../atoms/Step";
import { Tag } from "../atoms/Tag";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card content step" } satisfies StoryDefault;

// Dev-only demo copy (the fetched node's own sample text).
const STEP_TEXT =
  "Mash the banana in a mixing bowl, then add the rest of the wet ingredients & mix well.";

// Composer-supplied fill (the SLOT has no sample content) — see design/notes/CardContentStep.md.
const IngredientTags = () => (
  <>
    <Tag variant="neutral">Banana</Tag>
    <Tag variant="neutral">Wet ingredients</Tag>
  </>
);

export const Overview = () => (
  <>
    <StoryIntro what="One recipe step: the text, with the ingredient tags it uses." note="CardContentStep" />
    <Specimens>
      <Specimen label="without ingredient tags" hint="withIngredientTags={false}">
        <div className="w-96">
          <CardContentStep text={STEP_TEXT} withIngredientTags={false} />
        </div>
      </Specimen>
      <Specimen label="with ingredient tags">
        <div className="w-96">
          <CardContentStep text={STEP_TEXT} withIngredientTags>
            <IngredientTags />
          </CardContentStep>
        </div>
      </Specimen>
      <Specimen label="in Card" hint="paired with a Step badge via Card's step prop">
        <Card step={<Step>1</Step>}>
          <CardContentStep text={STEP_TEXT} withIngredientTags>
            <IngredientTags />
          </CardContentStep>
        </Card>
      </Specimen>
    </Specimens>
  </>
);
