// figma: node-id=3623:4345
import { ButtonToggle, type ButtonToggleItem } from "./ButtonToggle";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";

// One story: the working toggle group exactly as the fetched node draws it
// (5 icon-only segments sharing one track, one white capsule that slides to
// whichever segment is active) — per ticket #60, no other ButtonToggle
// stories. Labels come from the message catalog, not hardcoded strings.
const categories: readonly ButtonToggleItem[] = [
  { value: "all", icon: "Infinity", label: en.components.buttonToggle.categories.all },
  { value: "breakfast", icon: "Croissant", label: en.components.buttonToggle.categories.breakfast },
  { value: "lunch", icon: "Sandwich", label: en.components.buttonToggle.categories.lunch },
  { value: "vegetable", icon: "Broccoli", label: en.components.buttonToggle.categories.vegetable },
  { value: "dessert", icon: "CakeSlice", label: en.components.buttonToggle.categories.dessert },
];

const categoriesNl: readonly ButtonToggleItem[] = [
  { value: "all", icon: "Infinity", label: nl.components.buttonToggle.categories.all },
  { value: "breakfast", icon: "Croissant", label: nl.components.buttonToggle.categories.breakfast },
  { value: "lunch", icon: "Sandwich", label: nl.components.buttonToggle.categories.lunch },
  { value: "vegetable", icon: "Broccoli", label: nl.components.buttonToggle.categories.vegetable },
  { value: "dessert", icon: "CakeSlice", label: nl.components.buttonToggle.categories.dessert },
];

export const CategoryFilter = () => (
  <div className="flex flex-col gap-4">
    <ButtonToggle
      items={categories}
      defaultValue="all"
      aria-label={en.components.buttonToggle.groupLabel}
    />
    <ButtonToggle
      items={categoriesNl}
      defaultValue="all"
      aria-label={nl.components.buttonToggle.groupLabel}
    />
  </div>
);
