// figma: node-id=3670:1976
import type { ReactNode } from "react";
import { Carousel } from "./Carousel";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";

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

// Must return an array of real `CardContainer` siblings, not one wrapping
// component — Carousel's `Children.map` wraps each of its own immediate
// children in a fixed-width column, so a single `<Helper/>` would collapse
// all three columns into one. Card counts (4/3/2) deliberately differ per
// column to exercise the hug-height behaviour — see design/notes/Carousel.md.
function exampleColumns() {
  return [
    <CardContainer
      key="ontbijt"
      name="Ontbijt"
      count="4"
      addLabel={addLabel}
      editLabel={editLabel}
    >
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Amandel Pasta"
            duration="20 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Havermout"
            duration="10 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Yoghurt met Granola"
            duration="5 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Eieren met Spek"
            duration="15 min"
          />
        </ThumbnailBackdrop>
      </Card>
    </CardContainer>,
    <CardContainer
      key="lunch"
      name="Lunch"
      count="3"
      addLabel={addLabel}
      editLabel={editLabel}
    >
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Linzensoep"
            duration="30 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Caesar Salade"
            duration="15 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Tosti"
            duration="8 min"
          />
        </ThumbnailBackdrop>
      </Card>
    </CardContainer>,
    <CardContainer
      key="diner"
      name="Diner"
      count="2"
      addLabel={addLabel}
      editLabel={editLabel}
    >
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Kip Curry"
            duration="35 min"
          />
        </ThumbnailBackdrop>
      </Card>
      <Card>
        <ThumbnailBackdrop>
          <CardContentRecipe
            imageUrl={PLACEHOLDER_IMAGE}
            name="Zalm met Groenten"
            duration="25 min"
          />
        </ThumbnailBackdrop>
      </Card>
    </CardContainer>,
  ];
}

// Fits without scrolling on a wide viewport — the row only overflows
// relative to whatever width its own parent gives it.
export const Default = () => <Carousel>{exampleColumns()}</Carousel>;

// Constrained to the fetched node's own 644px designedWidth (w-161) to
// reproduce Figma's deliberate overflow. See design/notes/Carousel.md.
export const ConstrainedToDesignedWidth = () => (
  <div className="w-161">
    <Carousel>{exampleColumns()}</Carousel>
  </div>
);
