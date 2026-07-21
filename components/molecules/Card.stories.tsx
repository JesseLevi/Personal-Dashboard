// figma: node-id=3624:4448
import { Card } from "./Card";
import { CardContentRecipe } from "./CardContentRecipe";
import { CardContentIngredient } from "./CardContentIngredient";
import { CardContentTicket } from "./CardContentTicket";
import { CardContentStep } from "./CardContentStep";
import { Tag } from "../atoms/Tag";
import en from "../../messages/en.json";

const placeholderContent = (
  <p className="text-base font-semibold text-text-muted">Card content</p>
);

export const Default = () => <Card>{placeholderContent}</Card>;

export const WithTitle = () => (
  <Card title="Titel">{placeholderContent}</Card>
);

export const WithStep = () => <Card step={1}>{placeholderContent}</Card>;

export const WithTitleAndStep = () => (
  <Card title="Titel" step={1}>
    {placeholderContent}
  </Card>
);

// Dev-only placeholder photo for CardContentRecipe's thumbnail slot — same
// transparent-SVG + bg-surface-muted backdrop convention as
// CardContentRecipe.stories.tsx's own ThumbnailBackdrop, duplicated locally
// since this file composes the molecule rather than importing its story.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

const deleteLabel = en.components.cardContentIngredient.deleteLabel;

// One `Card` per built `Card-content/*` molecule (design/figma-map.json),
// each showing its own variant axis, so every kind of card content can be
// compared side by side in one place. Complete as of #21/#22: all four
// `Card-content/*` molecules Figma defines are represented. Add the next one
// here in the same PR that builds it.
export const AllContentTypes = () => (
  <div className="flex w-96 flex-col gap-4">
    <Card title="Recipe">
      <div className="grid">
        <div
          aria-hidden="true"
          className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-muted"
        />
        <div className="col-start-1 row-start-1">
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Amandel Pasta"
            duration="20 min"
          />
        </div>
      </div>
    </Card>
    <Card title="Ingredient">
      <div className="flex flex-col gap-2">
        <CardContentIngredient name="Banana" quantity="300 gr" />
        <CardContentIngredient name="Banana" quantity="300 gr" checked />
        <CardContentIngredient
          name="Banana"
          quantity="300 gr"
          checked={false}
          onDelete={() => {}}
          deleteLabel={deleteLabel}
        />
      </div>
    </Card>
    <Card title="Ticket">
      <CardContentTicket title="HBO Wachtwoord updaten">
        <Tag variant="medium">Medium</Tag>
        <Tag variant="neutral">S</Tag>
      </CardContentTicket>
    </Card>
    {/*
      Card-content/Step is the one content type that pairs with Card's own
      `step` prop rather than standing alone — the step *number* badge lives
      on the Card (composing the Step atom), the instruction text and its
      ingredient tags live in the content. See CardContentStep's doc comment.
    */}
    <Card title="Step" step={1}>
      <CardContentStep text="Mash the banana in a mixing bowl, then add the rest of the wet ingredients & mix well.">
        <Tag variant="neutral">Banana</Tag>
        <Tag variant="neutral">Wet ingredients</Tag>
      </CardContentStep>
    </Card>
  </div>
);
