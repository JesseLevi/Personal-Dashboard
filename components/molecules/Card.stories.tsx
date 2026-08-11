// figma: node-id=3624:4448
import { Card } from "./Card";
import { CardContentRecipe } from "./CardContentRecipe";
import { CardContentIngredient } from "./CardContentIngredient";
import { CardContentTicket } from "./CardContentTicket";
import { CardContentStep } from "./CardContentStep";
import { Button } from "../atoms/Button";
import { Tag } from "../atoms/Tag";
import en from "../../messages/en.json";

const placeholderContent = (
  <p className="text-base font-semibold text-text-secondary">Card content</p>
);

export const Default = () => <Card>{placeholderContent}</Card>;

export const WithTitle = () => (
  <Card title="Titel">{placeholderContent}</Card>
);

export const WithStep = () => <Card step={1}>{placeholderContent}</Card>;

// #160: `settings` slot (the ingredients Card's Pas-aan trigger). Rendered
// even without a `title` (the "no group label" case) — see design/notes/Card.md.
export const WithSettings = () => (
  <Card title="Ingrediënten" settings={<Button variant="filled" icon="Settings2" aria-label="Pas aan" />}>
    {placeholderContent}
  </Card>
);

export const WithSettingsNoTitle = () => (
  <Card settings={<Button variant="filled" icon="Settings2" aria-label="Pas aan" />}>
    {placeholderContent}
  </Card>
);

export const WithTitleAndStep = () => (
  <Card title="Titel" step={1}>
    {placeholderContent}
  </Card>
);

// Dev-only placeholder photo, same convention as CardContentRecipe.stories.tsx's ThumbnailBackdrop.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

const deleteLabel = en.components.cardContentIngredient.deleteLabel;

// One Card per built Card-content/* molecule — see design/notes/Card.md.
export const AllContentTypes = () => (
  <div className="flex w-96 flex-col gap-4">
    <Card title="Recipe">
      <div className="grid">
        <div
          aria-hidden="true"
          className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-primary"
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
        <CardContentIngredient name="Banana" quantity="300 gr" divider />
        <CardContentIngredient name="Banana" quantity="300 gr" checked divider />
        <CardContentIngredient
          name="Banana"
          quantity="300 gr"
          checked={false}
          onDelete={() => {}}
          deleteLabel={deleteLabel}
          swipeAction="delete"
        />
      </div>
    </Card>
    <Card title="Ticket">
      <CardContentTicket title="HBO Wachtwoord updaten">
        <Tag variant="medium">Medium</Tag>
        <Tag variant="neutral">S</Tag>
      </CardContentTicket>
    </Card>
    {/* Card-content/Step pairs with Card's own `step` prop — see design/notes/Card.md. */}
    <Card title="Step" step={1}>
      <CardContentStep text="Mash the banana in a mixing bowl, then add the rest of the wet ingredients & mix well.">
        <Tag variant="neutral">Banana</Tag>
        <Tag variant="neutral">Wet ingredients</Tag>
      </CardContentStep>
    </Card>
  </div>
);
