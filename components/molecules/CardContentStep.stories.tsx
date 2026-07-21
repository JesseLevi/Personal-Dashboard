// figma: node-id=3695:3941
import { CardContentStep } from "./CardContentStep";
import { Card } from "./Card";
import { Step } from "../atoms/Step";
import { Tag } from "../atoms/Tag";

// Dev-only demo copy (the fetched node's own sample text) — not user-facing
// UI chrome, same convention as CardContentRecipe/CardContentIngredient's
// stories: real step instructions are caller-supplied recipe content.
const STEP_TEXT =
  "Mash the banana in a mixing bowl, then add the rest of the wet ingredients & mix well.";

// The fetched SLOT has no sample Tag content (see the component's own doc
// comment) — these are a reasonable composer-supplied fill, reusing
// Tag's `neutral` variant the same way CardContentIngredient's quantity tag
// does, since that is the only precedent for tag styling in this codebase.
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

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type"), paired with a Step badge via Card's own `step` prop — this
// is the "Step + Tag" pairing described in the component's
// doc comment, happening at the Card level rather than inside
// CardContentStep itself.
export const InCard = () => (
  <Card step={<Step>1</Step>}>
    <CardContentStep text={STEP_TEXT} withIngredientTags>
      <IngredientTags />
    </CardContentStep>
  </Card>
);
