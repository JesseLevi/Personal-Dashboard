// figma: node-id=4164:23681
import { CardContentRecipeSkeleton } from "./CardContentRecipeSkeleton";
import { Card } from "./Card";
import nl from "../../messages/nl.json";

const label = nl.components.recipeImport.skeleton.loadingLabel;

// In the Card slot at the board's column content width (Figma Card 290px).
export const InCard = () => (
  <div className="w-72.5">
    <Card>
      <CardContentRecipeSkeleton label={label} />
    </Card>
  </div>
);
