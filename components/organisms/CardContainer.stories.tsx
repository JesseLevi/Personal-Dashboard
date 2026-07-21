// figma: node-id=3650:1297
import type { Story } from "@ladle/react";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build), same convention as CardContentRecipe.stories.tsx.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

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
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Amandel Pasta"
          duration="20 min"
        />
      </Card>
      <Card>
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Havermout"
          duration="10 min"
        />
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
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Amandel Pasta"
          duration="20 min"
        />
      </Card>
    </CardContainer>
  </div>
);

type PlaygroundProps = {
  name: string;
  count: string;
};

export const Playground: Story<PlaygroundProps> = ({ name, count }) => (
  <div className="w-96">
    <CardContainer
      name={name}
      count={count}
      addLabel={addLabelEn}
      editLabel={editLabelEn}
    >
      <Card>
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Amandel Pasta"
          duration="20 min"
        />
      </Card>
    </CardContainer>
  </div>
);

Playground.args = {
  name: "Ontbijt",
  count: "4",
};

Playground.argTypes = {
  name: { control: { type: "text" } },
  count: { control: { type: "text" } },
};
