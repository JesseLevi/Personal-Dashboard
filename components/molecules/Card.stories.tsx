// figma: node-id=3624:4448
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Card } from "./Card";
import { CardContentRecipe } from "./CardContentRecipe";
import { CardContentIngredient } from "./CardContentIngredient";
import { CardContentTicket } from "./CardContentTicket";
import { CardContentStep } from "./CardContentStep";
import { Button } from "../atoms/Button";
import { Tag } from "../atoms/Tag";
import en from "../../messages/en.json";
import type { Story, StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Card" } satisfies StoryDefault;

const placeholderContent = (
  <p className="text-base font-semibold text-text-secondary">Card content</p>
);

const settingsButton = <Button variant="filled" icon="Settings2" aria-label="Pas aan" />;

// `contentClassName` swaps the Type slot's surface (the loading skeletons bind
// surface-primary / surface-secondary); `settings` renders even without a title.
export const Overview = () => (
  <>
    <StoryIntro what="The frame around one piece of content: optional title, step number and settings button." note="Card" />
    <Specimens>
      <Specimen label="default" hint="content only">
        <div className="w-72">
          <Card>{placeholderContent}</Card>
        </div>
      </Specimen>
      <Specimen label="title">
        <div className="w-72">
          <Card title="Titel">{placeholderContent}</Card>
        </div>
      </Specimen>
      <Specimen label="step">
        <div className="w-72">
          <Card step={1}>{placeholderContent}</Card>
        </div>
      </Specimen>
      <Specimen label="title + step">
        <div className="w-72">
          <Card title="Titel" step={1}>
            {placeholderContent}
          </Card>
        </div>
      </Specimen>
      <Specimen label="settings" hint="Pas-aan trigger next to the title">
        <div className="w-72">
          <Card title="Ingrediënten" settings={settingsButton}>
            {placeholderContent}
          </Card>
        </div>
      </Specimen>
      <Specimen label="settings, no title" hint="the no-group-label case">
        <div className="w-72">
          <Card settings={settingsButton}>{placeholderContent}</Card>
        </div>
      </Specimen>
      <Specimen label="contentClassName" hint="surface-primary">
        <div className="w-72">
          <Card contentClassName="bg-surface-primary">{placeholderContent}</Card>
        </div>
      </Specimen>
      <Specimen label="contentClassName" hint="surface-secondary">
        <div className="w-72">
          <Card contentClassName="bg-surface-secondary">{placeholderContent}</Card>
        </div>
      </Specimen>
    </Specimens>
  </>
);

type PlaygroundProps = { title: string; step: string; withSettings: boolean; surface: "default" | "primary" | "secondary" };

const SURFACE = { default: undefined, primary: "bg-surface-primary", secondary: "bg-surface-secondary" } as const;

export const Playground: Story<PlaygroundProps> = ({ title, step, withSettings, surface }) => (
  <div className="w-72">
    <Card
      title={title || undefined}
      step={step || undefined}
      settings={withSettings ? settingsButton : undefined}
      contentClassName={SURFACE[surface]}
    >
      {placeholderContent}
    </Card>
  </div>
);
Playground.args = { title: "Titel", step: "", withSettings: false, surface: "default" };
Playground.argTypes = {
  title: { control: { type: "text" } },
  step: { control: { type: "text" } },
  withSettings: { control: { type: "boolean" } },
  surface: { control: { type: "inline-radio" }, options: ["default", "primary", "secondary"] },
};

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
