import { useState } from "react";
import { RecipeIngredientRow } from "./RecipeIngredientRow";
import nl from "../../messages/nl.json";
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

// Row 1: labelled (Figma `Title: true`) — Item/Aantal/Eenheid field labels
// visible, plus the delete Button every real data row carries (#166; the
// invisible label-height spacer keeps it level with the boxes, not the labels).
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
    onRemove={() => {}}
    removeLabel="Verwijder ingrediënt"
  />
);

// Rows 2/3: unlabelled (Figma `Title: false`) — same fields, no label row,
// same trailing delete Button.
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
// `removeDisabled` demonstrates the sole-remaining-row case (RecipePanel.tsx
// disables rather than hides, matching PortionStepper's own min-floor precedent).
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
    onRemove={() => {}}
    removeLabel="Verwijder ingrediënt"
    removeDisabled
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
      onRemove={() => {}}
      removeLabel="Verwijder ingrediënt"
    />
  );
};

// #318 (Claude-designed on request): "controleren" marker above an imported line
// the importer was unsure about; it opens the same picker as the name field.
export const NeedsReview = () => (
  <RecipeIngredientRow
    id="story-row-review"
    showLabels
    itemLabel="Item"
    quantityLabel="Aantal"
    unitLabel="Eenheid"
    name="Knoflook (teentje)"
    namePlaceholder="Kies een ingrediënt"
    onNameClick={() => {}}
    quantity={1}
    quantityPlaceholder="0"
    onQuantityChange={() => {}}
    unit="stuk"
    unitPlaceholder="Kies eenheid"
    unitOptions={UNIT_OPTIONS}
    onUnitChange={() => {}}
    onRemove={() => {}}
    removeLabel="Verwijder ingrediënt"
    reviewLabel={nl.components.recipePanel.fields.needsReviewLabel}
  />
);

// Claude-designed on request (2026-10-07): the line under the fields names
// what the nutrition calculator uses, so a wrong or missing NEVO link shows.
export const LinkInfo = () => (
  <div className="flex flex-col gap-6">
    <RecipeIngredientRow
      id="story-row-linked"
      showLabels
      itemLabel="Item"
      quantityLabel="Aantal"
      unitLabel="Eenheid"
      name="Selderij"
      namePlaceholder="Kies een ingrediënt"
      onNameClick={() => {}}
      quantity={2}
      quantityPlaceholder="0"
      onQuantityChange={() => {}}
      unit="stuk"
      unitPlaceholder="Kies eenheid"
      unitOptions={UNIT_OPTIONS}
      onUnitChange={() => {}}
      onRemove={() => {}}
      removeLabel="Verwijder ingrediënt"
      linkInfo="NEVO: Selderij bleek- rauw · 17 kcal per 100 g · 1 stuk ≈ 40 g"
    />
    <RecipeIngredientRow
      id="story-row-unlinked"
      itemLabel="Item"
      quantityLabel="Aantal"
      unitLabel="Eenheid"
      name="Garnalen"
      namePlaceholder="Kies een ingrediënt"
      onNameClick={() => {}}
      quantity={200}
      quantityPlaceholder="0"
      onQuantityChange={() => {}}
      unit="gram"
      unitPlaceholder="Kies eenheid"
      unitOptions={UNIT_OPTIONS}
      onUnitChange={() => {}}
      onRemove={() => {}}
      removeLabel="Verwijder ingrediënt"
      reviewLabel={nl.components.recipePanel.fields.needsReviewLabel}
      linkInfo={nl.components.recipePanel.link.none}
    />
  </div>
);
