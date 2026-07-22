// figma: node-id=3670:1976
import { Carousel } from "./Carousel";
import { CardContainer } from "./CardContainer";
import { Card } from "../molecules/Card";
import { CardContentRecipe } from "../molecules/CardContentRecipe";
import en from "../../messages/en.json";

// Dev-only placeholder photo (inline data URI, no network dependency for the
// Ladle build), same convention as CardContainer.stories.tsx.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

const addLabel = en.components.cardContainer.addLabel;
const editLabel = en.components.cardContainer.editLabel;

// Composed exactly as the fetched node nests: Carousel > (Slot) >
// Card-container > Card > Card-content/Recipe, matching the fetched
// example instance's three Card-container columns.
export const Default = () => (
  <Carousel>
    <CardContainer
      name="Ontbijt"
      count="4"
      addLabel={addLabel}
      editLabel={editLabel}
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
    <CardContainer
      name="Lunch"
      count="3"
      addLabel={addLabel}
      editLabel={editLabel}
    >
      <Card>
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Linzensoep"
          duration="30 min"
        />
      </Card>
    </CardContainer>
    <CardContainer
      name="Diner"
      count="5"
      addLabel={addLabel}
      editLabel={editLabel}
    >
      <Card>
        <CardContentRecipe
          imageUrl={PLACEHOLDER_IMAGE}
          name="Kip Curry"
          duration="35 min"
        />
      </Card>
    </CardContainer>
  </Carousel>
);
