import { useState } from "react";
import { RecipeIngredientRow } from "./RecipeIngredientRow";
import type { UnitCode } from "@/lib/recipes/units";

// Dev-only demo copy — real labels/units come from next-intl at the call
// site (app/(app)/recepten/RecipePanel.tsx).
const UNIT_OPTIONS: { code: UnitCode; label: string }[] = [
  { code: "gram", label: "Gram" },
  { code: "kilogram", label: "Kilogram" },
  { code: "liter", label: "Liter" },
  { code: "scoop", label: "Scoop" },
  { code: "stuk", label: "Stuk" },
];

// Row 1: labelled (Figma `Title: true`) — Item/Aantal/Eenheid field labels visible.
export const Labelled = () => (
  <RecipeIngredientRow
    id="story-row-1"
    showLabels
    itemLabel="Item"
    quantityLabel="Aantal"
    unitLabel="Eenheid"
    name="Havermout"
    namePlaceholder="Kies een ingrediënt"
    onNameClick={() => {}}
    quantity={1250}
    quantityPlaceholder="0"
    onQuantityChange={() => {}}
    unit="gram"
    unitPlaceholder="Kies eenheid"
    unitOptions={UNIT_OPTIONS}
    onUnitChange={() => {}}
  />
);

// Rows 2/3: unlabelled (Figma `Title: false`) — same fields, no label row,
// plus the trailing delete Button (#166) every non-first row carries.
export const Unlabelled = () => (
  <RecipeIngredientRow
    id="story-row-2"
    itemLabel="Item"
    quantityLabel="Aantal"
    unitLabel="Eenheid"
    name="Proteine poeder"
    namePlaceholder="Kies een ingrediënt"
    onNameClick={() => {}}
    quantity={2}
    quantityPlaceholder="0"
    onQuantityChange={() => {}}
    unit="scoop"
    unitPlaceholder="Kies eenheid"
    unitOptions={UNIT_OPTIONS}
    onUnitChange={() => {}}
    onRemove={() => {}}
    removeLabel="Verwijder ingrediënt"
  />
);

// Empty/new row — the build decision this ticket flags: no blank row is
// drawn anywhere in Figma, unit defaults to "gram" rather than staying unset.
export const Empty = () => (
  <RecipeIngredientRow
    id="story-row-empty"
    showLabels
    itemLabel="Item"
    quantityLabel="Aantal"
    unitLabel="Eenheid"
    name=""
    namePlaceholder="Kies een ingrediënt"
    onNameClick={() => {}}
    quantity={null}
    quantityPlaceholder="0"
    onQuantityChange={() => {}}
    unit="gram"
    unitPlaceholder="Kies eenheid"
    unitOptions={UNIT_OPTIONS}
    onUnitChange={() => {}}
  />
);

// Interactive: exercises quantity typing and the unit Dropdown's
// key-remount-closes-on-select pattern (clicking a name field only logs —
// opening the real search panel is RecipePanel's own responsibility).
export const Interactive = () => {
  const [quantity, setQuantity] = useState<number | null>(1250);
  const [unit, setUnit] = useState<UnitCode | "">("gram");

  return (
    <RecipeIngredientRow
      id="story-row-interactive"
      showLabels
      itemLabel="Item"
      quantityLabel="Aantal"
      unitLabel="Eenheid"
      name="Havermout"
      namePlaceholder="Kies een ingrediënt"
      onNameClick={() => console.log("open ingredient search")}
      quantity={quantity}
      quantityPlaceholder="0"
      onQuantityChange={setQuantity}
      unit={unit}
      unitPlaceholder="Kies eenheid"
      unitOptions={UNIT_OPTIONS}
      onUnitChange={setUnit}
    />
  );
};
