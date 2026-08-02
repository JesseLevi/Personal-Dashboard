import clsx from "clsx";
import { InputField } from "../atoms/InputField";
import type { UnitCode } from "@/lib/recipes/units";

/**
 * Molecule/RecipeIngredientRow — #126's ingredient row: three `Input-field`
 * instances side by side (name/quantity/unit), matching Figma's "Rij" frame
 * (`3777:2926`/`3717:2930`/`3717:2934`). Not itself a fetched Figma
 * component (a "Rij" is three separate instances, never one named
 * component) — no `figma-map.json` entry, per the ticket's own instruction.
 * Name is read-only (opens #131's `IngredientSearchPanel` on click, per its
 * Dev Mode annotation); quantity is free numeric entry; unit uses
 * `InputField`'s `options` (select) variant (#149) — genuinely labelless and
 * closed on rows 2/3 now, unlike the `Dropdown` this replaced. Full
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
    </div>
  );
}
