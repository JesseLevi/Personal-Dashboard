// figma: node-id=3670:1976
import type { ReactNode } from "react";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Carousel } from "./Carousel";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";
import type { StoryDefault } from "@ladle/react";

export default { title: "Basis / Kaarten / Carousel" } satisfies StoryDefault;

// Dev-only placeholder photo — no fill of its own to reproduce on the
// `<img>`; ThumbnailBackdrop below supplies it. See
// design/notes/CardContentRecipe.md.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// Backdrop behind the placeholder image, same size as the thumbnail. See
// design/notes/CardContentRecipe.md.
const ThumbnailBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="grid">
    <div
      aria-hidden="true"
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-primary"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

const addLabel = en.components.cardContainer.addLabel;
const editLabel = en.components.cardContainer.editLabel;

const Recipe = ({ name, duration }: { name: string; duration: string }) => (
  <Card>
    <ThumbnailBackdrop>
      <CardContentRecipe imageUrl={PLACEHOLDER_IMAGE} name={name} duration={duration} />
    </ThumbnailBackdrop>
  </Card>
);

// Must return an array of real `CardContainer` siblings, not one wrapping
// component: Carousel's `Children.map` wraps each immediate child in a fixed-width
// column. Counts (4/3/2) differ on purpose to exercise hug-height (design/notes/Carousel.md).
function exampleColumns() {
  return [
    <CardContainer key="ontbijt" name="Ontbijt" count="4" addLabel={addLabel} editLabel={editLabel}>
      <Recipe name="Amandel Pasta" duration="20 min" />
      <Recipe name="Havermout" duration="10 min" />
      <Recipe name="Yoghurt met Granola" duration="5 min" />
      <Recipe name="Eieren met Spek" duration="15 min" />
    </CardContainer>,
    <CardContainer key="lunch" name="Lunch" count="3" addLabel={addLabel} editLabel={editLabel}>
      <Recipe name="Linzensoep" duration="30 min" />
      <Recipe name="Caesar Salade" duration="15 min" />
      <Recipe name="Tosti" duration="8 min" />
    </CardContainer>,
    <CardContainer key="diner" name="Diner" count="2" addLabel={addLabel} editLabel={editLabel}>
      <Recipe name="Kip Curry" duration="35 min" />
      <Recipe name="Zalm met Groenten" duration="25 min" />
    </CardContainer>,
  ];
}

export const Overview = () => (
  <>
    <StoryIntro what="A horizontal row of fixed-width columns that scrolls when its parent is narrower." note="Carousel" />
    <Specimens>
      <Specimen label="fits" hint="wide parent: no scrolling">
        <Carousel>{exampleColumns()}</Carousel>
      </Specimen>
      <Specimen label="overflows" hint="constrained to Figma's 644 px designed width (w-161)">
        <div className="w-161">
          <Carousel>{exampleColumns()}</Carousel>
        </div>
      </Specimen>
    </Specimens>
  </>
);

// Constrained to 644 px: scroll the row sideways to reach the last column.
export const Interactive = () => (
  <div className="w-161">
    <Carousel>{exampleColumns()}</Carousel>
  </div>
);
