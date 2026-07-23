// figma: node-id=3650:1297
import type { ReactNode } from "react";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

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
      className="col-start-1 row-start-1 h-24 w-24 rounded bg-surface-muted"
    />
    <div className="col-start-1 row-start-1">{children}</div>
  </div>
);

// Chrome text — sourced from the message catalog, not typed here directly.
const addLabelEn = en.components.cardContainer.addLabel;
const editLabelEn = en.components.cardContainer.editLabel;

// Matches the fetched node's "Ontbijt" sample (Name="Ontbijt", Hoeveelheid="4").
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
