// figma: node-id=4164:23627 (+4164:23731 mobile)
import { CardContainer } from "@/components/organisms/CardContainer";
import { Card } from "@/components/molecules/Card";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { AddRecipeMenu } from "./AddRecipeMenu";
import nl from "../../../messages/nl.json";

// No photo: CardContentRecipe renders its bg-surface-primary placeholder square.
const NO_PHOTO = undefined;

// The menu open under a column's Plus button, over the column's first card,
// as drawn in the Figma frame (dropdown top-left over the first card).
export const Open = () => (
  <div className="w-80">
    <CardContainer
      name="Ontbijt"
      count="2"
      icon="Croissant"
      addLabel={nl.components.cardContainer.addLabel}
      editLabel={nl.components.cardContainer.editLabel}
      addMenu={<AddRecipeMenu open onClose={() => {}} onViaLink={() => {}} onManual={() => {}} />}
    >
      <Card>
        <CardContentRecipe imageUrl={NO_PHOTO} name="Amandel Pasta" duration="20 min" />
      </Card>
      <Card>
        <CardContentRecipe imageUrl={NO_PHOTO} name="Beans on toast" duration="20 min" />
      </Card>
    </CardContainer>
  </div>
);
