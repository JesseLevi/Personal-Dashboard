// figma: node-id=3670:1976
import type { ReactNode } from "react";
import { Carousel } from "./Carousel";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build), same convention as CardContainer.stories.tsx. Shape only, no
// colour baked in (a 1x1 transparent SVG) — the fetched Figma node
// (3628:67) gives the Thumbnail frame no fill of its own besides the IMAGE
// fill itself, so there is no background to reproduce on the `<img>`; the
// visual footprint is conveyed by the `ThumbnailBackdrop` below instead,
// same as CardContentRecipe.stories.tsx / Card.stories.tsx's own fix for
// this exact placeholder-invisibility problem.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

// Renders a `bg-surface-muted` box the same size as the thumbnail (h-24
// w-24, matching CardContentRecipe's own sizing) behind the story's render,
// duplicated locally per CardContentRecipe.stories.tsx/Card.stories.tsx's
// own precedent (this file composes the molecule rather than importing its
// story).
const ThumbnailBackdrop = ({ children }: { children: ReactNode }) => (
  <div className="grid">
    <div
      aria-hidden="true"
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-muted"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

const addLabel = en.components.cardContainer.addLabel;
const editLabel = en.components.cardContainer.editLabel;

// Composed exactly as the fetched node nests: Carousel > (Slot) >
// Card-container > Card > Card-content/Recipe. Returns a fresh array of
// three top-level `CardContainer` elements — Carousel's `Children.map`
// wraps each of its *own* immediate children in a fixed-width column, so
// this must hand it three real siblings, not a single wrapping component
// (a `<Helper />` element would itself be the one-and-only child Carousel
// sees, collapsing all three columns into one box — caught by rendering
// this exact story and finding the columns stacked instead of side by
// side). Called fresh per story so the two exports below don't share
// element instances.
//
// Card counts per column (4 / 3 / 2) deliberately DIFFER and match each
// column's own `count` prop — a ragged case the fetched Figma node never
// shows (its three sample instances all hold identical 4-card content) but
// which a real kanban board hits constantly, and which is exactly what
// makes the "hug your own content" column-height fix (see Carousel.tsx's
// doc comment) visible at all: equal card counts everywhere would render
// identically whether columns hug or stretch.
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

// Unconstrained row — on a wide-enough viewport the three fixed 280px
// columns fit without scrolling, since the row only overflows relative to
// whatever width its own parent gives it (see Carousel.tsx's doc comment).
export const Default = () => <Carousel>{exampleColumns()}</Carousel>;

// Constrained to the fetched node's own `designedWidth` (644px, i.e.
// Tailwind's w-161) so the deliberate overflow Figma's node shows —
// 3 x 280px columns + 2 x 16px gaps = 872px of content inside a 644px
// frame, ~2.3 columns visible — actually reproduces here. Scrolls via the
// browser's native horizontal scrollbar (`overflow-x-auto`); see the
// component doc comment for why that, and not arrow/dot controls, was
// chosen, and `design/notes/Carousel.md` for the still-open question of
// whether a native scrollbar is the intended final affordance.
export const ConstrainedToDesignedWidth = () => (
  <div className="w-161">
    <Carousel>{exampleColumns()}</Carousel>
  </div>
);
