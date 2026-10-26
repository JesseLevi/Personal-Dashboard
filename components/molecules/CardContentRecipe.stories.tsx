// figma: node-id=3628:67
import type { ReactNode } from "react";
import type { Story, StoryDefault } from "@ladle/react";
import { CardContentRecipe } from "./CardContentRecipe";
import { Card } from "./Card";

export default { title: "Basis / Kaarten / Card content recipe" } satisfies StoryDefault;

// Dev-only 1x1 transparent placeholder; visual footprint comes from the ThumbnailBackdrop below.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// bg-surface-primary box behind the transparent placeholder so it still reads as a photo slot.
const ThumbnailBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="grid">
    <div
      aria-hidden="true"
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-primary"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

export const Default = () => (
  <ThumbnailBackdrop>
    <CardContentRecipe
      imageUrl={PLACEHOLDER_IMAGE}
      name="Amandel Pasta"
      duration="20 min"
    />
  </ThumbnailBackdrop>
);

// Composed inside the Card molecule the way it slots in production (Card's
// SLOT "Type").
export const InCard = () => (
  <Card>
    <ThumbnailBackdrop>
      <CardContentRecipe
        imageUrl={PLACEHOLDER_IMAGE}
        name="Amandel Pasta"
        duration="20 min"
      />
    </ThumbnailBackdrop>
  </Card>
);

// #124's two new optional-prop branches, which the stories above never reach
// because they all pass an explicit imageUrl and duration: a recipe with no
// stored photo (imageUrl absent -> the molecule's own bg-surface-primary
// placeholder, no ThumbnailBackdrop needed) and a nullable time_minutes
// (duration absent -> the Timer row is omitted, not rendered empty).
export const NoPhotoOrDuration = () => (
  <Card>
    <CardContentRecipe name="Amandel Pasta" />
  </Card>
);

// Claude-designed (#487): the compact row of the Agenda's plan drawer.
export const Compact = () => (
  <div className="w-72">
    <CardContentRecipe compact name="Lasagne met spinazie" duration="60 min" />
  </div>
);

export const CompactNoPhotoLongName = () => (
  <div className="w-72">
    <CardContentRecipe compact name="Gestoofde kip met olijven, citroen en geroosterde venkel" />
  </div>
);

type PlaygroundProps = {
  name: string;
  duration: string;
};

export const Playground: Story<PlaygroundProps> = ({ name, duration }) => (
  <ThumbnailBackdrop>
    <CardContentRecipe
      imageUrl={PLACEHOLDER_IMAGE}
      name={name}
      duration={duration}
    />
  </ThumbnailBackdrop>
);

Playground.args = {
  name: "Amandel Pasta",
  duration: "20 min",
};

Playground.argTypes = {
  name: { control: { type: "text" } },
  duration: { control: { type: "text" } },
};
