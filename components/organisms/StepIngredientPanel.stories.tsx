// figma: node-id=3749:3091 (panel 3749:3241)
import { useState } from "react";
import { StepIngredientPanel } from "./StepIngredientPanel";

// Sample ingredients matching the fetched node's own tags ("1250 Gram",
// "2 Scoops", "1 Stuk") — RecipePanel.stories.tsx uses the same values for
// its own sample recipe. One row has an empty name to exercise the "rows
// with an empty name are never rendered" rule.
const sampleIngredients = [
  { localId: "ingredient-1", name: "Havermout", quantityLabel: "1250 Gram" },
  { localId: "ingredient-2", name: "Proteine poeder", quantityLabel: "2 Scoops" },
  { localId: "ingredient-3", name: "Citroen", quantityLabel: "1 Stuk" },
  { localId: "ingredient-4", name: "", quantityLabel: "0 Gram" },
];

// `min-h-screen` wrapper — SidePanel.stories.tsx's own precedent
// (design/notes/SidePanel.md): SidePanel is `position: fixed`, contributing
// 0 to ancestor flow height, so the screenshot harness needs a non-zero
// crop area.
export const Empty = () => (
  <div className="min-h-screen">
    <StepIngredientPanel
      open
      onClose={() => {}}
      ingredients={sampleIngredients}
      selectedIds={[]}
      onSave={() => {}}
    />
  </div>
);

export const WithSelection = () => (
  <div className="min-h-screen">
    <StepIngredientPanel
      open
      onClose={() => {}}
      ingredients={sampleIngredients}
      selectedIds={["ingredient-1", "ingredient-3"]}
      onSave={() => {}}
    />
  </div>
);

// Interactive: exercises checkbox toggling and Opslaan's onSave payload.
export const Interactive = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>(["ingredient-2"]);
  return (
    <div className="min-h-screen">
      <StepIngredientPanel
        open
        onClose={() => {}}
        ingredients={sampleIngredients}
        selectedIds={selectedIds}
        onSave={(next) => {
          setSelectedIds(next);
          console.log("onSave", next);
        }}
      />
    </div>
  );
};
