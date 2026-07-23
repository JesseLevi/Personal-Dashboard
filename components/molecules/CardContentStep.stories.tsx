// figma: node-id=3695:3941
import { CardContentStep } from "./CardContentStep";
import { Card } from "./Card";
import { Step } from "../atoms/Step";
import { Tag } from "../atoms/Tag";

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

export const WithoutIngredientTags = () => (
  <div className="w-96">
    <CardContentStep text={STEP_TEXT} withIngredientTags={false} />
  </div>
);

export const WithIngredientTags = () => (
  <div className="w-96">
    <CardContentStep text={STEP_TEXT} withIngredientTags>
      <IngredientTags />
    </CardContentStep>
  </div>
);

// Composed inside Card, paired with a Step badge via Card's own `step` prop.
export const InCard = () => (
  <Card step={<Step>1</Step>}>
    <CardContentStep text={STEP_TEXT} withIngredientTags>
      <IngredientTags />
    </CardContentStep>
  </Card>
);
