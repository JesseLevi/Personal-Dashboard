import clsx from "clsx";
import { Button } from "../atoms/Button";
import { InputField } from "../atoms/InputField";
import type { UnitCode } from "@/lib/recipes/units";

/**
 * Molecule/RecipeIngredientRow — #126's ingredient row: three `Input-field`
 * instances side by side (name/quantity/unit), matching Figma's "Rij" frame.
 * Not itself a fetched Figma component — no `figma-map.json` entry, per the
 * ticket's own instruction. Name opens #131's `IngredientSearchPanel`;
 * quantity is free numeric entry; unit uses `InputField`'s `options` variant
 * (#149). `onRemove` (#166) adds a trailing destructive `Trash` Button,
 * matching node 4025:10610 — every row but the first carries one. Full
 * reasoning: `design/notes/RecipeIngredientRow.md`.
 */
export interface RecipeIngredientRowProps {
  /** Stable per-row id, used to derive every field's `id`. */
  id: string;
  /** Row 1 only (Figma `Title: true`) — renders visible field labels. Rows 2/3 have `Title: false`. */
  showLabels?: boolean;
  itemLabel: string;
  quantityLabel: string;
  unitLabel: string;
  name: string;
  namePlaceholder: string;
  onNameClick: () => void;
  quantity: number | null;
  quantityPlaceholder: string;
  onQuantityChange: (value: number | null) => void;
  unit: UnitCode | "";
  unitPlaceholder: string;
  unitOptions: { code: UnitCode; label: string }[];
  onUnitChange: (unit: UnitCode) => void;
  /** Removes this row (#166) — omit to hide the trailing delete Button (Figma's row 1 has none). Renders only when both this and `removeLabel` are given (checked independently at render, not via a discriminated union — RecipePanel.tsx's own conditional spread doesn't preserve one across a `.map()`), so a caller that forgets `removeLabel` silently gets no button rather than a Button with no accessible name. */
  onRemove?: () => void;
  /** Accessible name for the delete Button — required alongside `onRemove` for the button to render at all (see `onRemove`'s own doc comment). */
  removeLabel?: string;
  className?: string;
}

export function RecipeIngredientRow({
  id,
  showLabels,
  itemLabel,
  quantityLabel,
  unitLabel,
  name,
  namePlaceholder,
  onNameClick,
  quantity,
  quantityPlaceholder,
  onQuantityChange,
  unit,
  unitPlaceholder,
  unitOptions,
  onUnitChange,
  onRemove,
  removeLabel,
  className,
}: RecipeIngredientRowProps) {
  const selectOptions = unitOptions.map((option) => ({ value: option.code, label: option.label }));

  return (
    <div className={clsx("flex w-full items-start gap-2", className)}>
      <div className="w-full min-w-0 flex-1">
        {showLabels ? (
          <InputField
            id={`${id}-name`}
            label={itemLabel}
            trailingIcon="ArrowRightLeft"
            readOnly
            placeholder={namePlaceholder}
            value={name}
            onClick={onNameClick}
          />
        ) : (
          <InputField
            id={`${id}-name`}
            trailingIcon="ArrowRightLeft"
            readOnly
            placeholder={namePlaceholder}
            value={name}
            onClick={onNameClick}
          />
        )}
      </div>
      <div className="w-[104px] shrink-0">
        {showLabels ? (
          <InputField
            id={`${id}-quantity`}
            label={quantityLabel}
            type="number"
            inputMode="decimal"
            placeholder={quantityPlaceholder}
            value={quantity ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              onQuantityChange(raw === "" ? null : Number(raw));
            }}
          />
        ) : (
          <InputField
            id={`${id}-quantity`}
            type="number"
            inputMode="decimal"
            placeholder={quantityPlaceholder}
            value={quantity ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              onQuantityChange(raw === "" ? null : Number(raw));
            }}
          />
        )}
      </div>
      <div className="w-[104px] shrink-0">
        {showLabels ? (
          <InputField
            id={`${id}-unit`}
            label={unitLabel}
            options={selectOptions}
            placeholderOption={unitPlaceholder}
            trailingIcon="ChevronDown"
            value={unit}
            onChange={(event) => onUnitChange(event.target.value as UnitCode)}
          />
        ) : (
          <InputField
            id={`${id}-unit`}
            options={selectOptions}
            placeholderOption={unitPlaceholder}
            trailingIcon="ChevronDown"
            value={unit}
            onChange={(event) => onUnitChange(event.target.value as UnitCode)}
          />
        )}
      </div>
      {/* Two independent truthiness checks, not one — `onRemove`/`removeLabel`
          are destructured out of a discriminated union, and TypeScript does
          not re-correlate two separately-destructured bindings from the
          same branch, so checking only `onRemove` would leave `removeLabel`
          typed `string | undefined` here. */}
      {onRemove && removeLabel && (
        <Button
          variant="destructive"
          icon="Trash"
          aria-label={removeLabel}
          onClick={onRemove}
        />
      )}
    </div>
  );
}
