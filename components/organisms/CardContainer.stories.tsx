// figma: node-id=3650:1297
import type { ReactNode } from "react";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build), same convention as CardContentRecipe.stories.tsx. Shape
// only, no colour baked in (a 1x1 transparent SVG) — the fetched Figma node
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

// The add/edit buttons' aria-labels ARE user-facing chrome text, so they come
// from the message catalog rather than being typed here directly (same
// convention CardContentIngredient.stories.tsx uses for its delete label).
const addLabelEn = en.components.cardContainer.addLabel;
const editLabelEn = en.components.cardContainer.editLabel;

// Composed exactly as the fetched node nests: Card-container > Card >
// Card-content/Recipe, matching the "Ontbijt" sample (Name="Ontbijt",
// Hoeveelheid="4").
export const Default = () => (
  <div className="w-96">
    <CardContainer
      name="Ontbijt"
      count="4"
      addLabel={addLabelEn}
      editLabel={editLabelEn}
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
    </CardContainer>
  </div>
);

// NL catalog check for the add/edit labels.
export const LabelsNl = () => (
  <div className="w-96">
    <CardContainer
      name="Ontbijt"
      count="4"
      addLabel={nl.components.cardContainer.addLabel}
      editLabel={nl.components.cardContainer.editLabel}
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
    </CardContainer>
  </div>
);
