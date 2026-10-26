// figma: node-id=4164:23627 (+4164:23731 mobile)
import { Button } from "@/components/atoms/Button";
import { Carousel } from "@/components/organisms/Carousel";
import { CardContainer } from "@/components/organisms/CardContainer";
import { Card } from "@/components/molecules/Card";
import { CardContentRecipe } from "@/components/molecules/CardContentRecipe";
import { AddRecipeMenu } from "./AddRecipeMenu";
import nl from "../../../messages/nl.json";
import { StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Recepten / Add recipe menu" } satisfies StoryDefault;

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

// Regression (#309 follow-up): with no recipes yet the column is shorter than
// the menu and the carousel's overflow-x clipped it in half. The menu is
// portalled to <body>, so it must show in full below the Plus button
// (`min-h-48` only makes the screenshot area tall enough to show that).
export const OpenInEmptyColumn = () => (
  <div className="min-h-48">
    <Carousel columnWidthClassName="w-80">
      <CardContainer
        name="Ontbijt"
        count="0"
        icon="Croissant"
        addLabel={nl.components.cardContainer.addLabel}
        editLabel={nl.components.cardContainer.editLabel}
        addMenu={<AddRecipeMenu open onClose={() => {}} onViaLink={() => {}} onManual={() => {}} />}
        emptyState={
          <Button variant="white" icon="Plus">
            {nl.components.cardContainer.addLabel}
          </Button>
        }
      />
    </Carousel>
  </div>
);

// The menu open under a column's Plus button, with the intro above.
export const Overview = () => (
  <div className="flex flex-col gap-stack-md">
    <StoryIntro
      what="Menu under the Plus button of a recipe column: add a recipe from a link or write one by hand."
      note="AddRecipeMenu"
    />
    <Open />
  </div>
);
