// figma: node-id=3628:67
import type { ReactNode } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
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

// No stored photo: the molecule draws its own bg-surface-primary placeholder; no duration: the Timer row is omitted.
export const Overview = () => (
  <>
    <StoryIntro what="A recipe's photo, name and duration, as shown inside a Card." note="CardContentRecipe" />
    <Specimens>
      <Specimen label="default" hint="photo, name, duration">
        <ThumbnailBackdrop>
          <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name="Amandel Pasta" duration="20 min" />
        </ThumbnailBackdrop>
      </Specimen>
      <Specimen label="in Card" hint="how it slots in (Card SLOT Type)">
        <Card>
          <ThumbnailBackdrop>
            <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name="Amandel Pasta" duration="20 min" />
          </ThumbnailBackdrop>
        </Card>
      </Specimen>
      <Specimen label="no photo, no duration" hint="imageUrl and duration absent">
        <Card>
          <CardContentRecipe name="Amandel Pasta" />
        </Card>
      </Specimen>
      <Specimen label="compact" hint="Agenda plan drawer row">
        <div className="w-72">
          <CardContentRecipe compact name="Lasagne met spinazie" duration="60 min" />
        </div>
      </Specimen>
      <Specimen label="compact, long name, no photo">
        <div className="w-72">
          <CardContentRecipe compact name="Gestoofde kip met olijven, citroen en geroosterde venkel" />
        </div>
      </Specimen>
    </Specimens>
  </>
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
