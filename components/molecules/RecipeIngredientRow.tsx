import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms/Button";
import { InputField } from "../atoms/InputField";
import type { UnitCode } from "@/lib/recipes/units";

/**
 * Molecule/RecipeIngredientRow — #126's ingredient row: three `Input-field`
 * instances side by side (name/quantity/unit), matching Figma's "Rij" frame.
 * Not itself a fetched Figma component — no `figma-map.json` entry, per the
 * ticket's own instruction. Name opens #131's `IngredientSearchPanel`;
 * quantity is free numeric entry; unit uses `InputField`'s `options` variant
 * (#149). #166 re-fetched node 4025:10596 ("Ingredienten"): every real data
 * row (not the label-only header row) carries a trailing destructive `Trash`
 * Button, so `onRemove`/`removeLabel` are now unconditional (`removeDisabled`
 * covers the "last row" edge case Figma never draws). Aantal's fixed column
 * width is 72px there, not 104 (Eenheid's own width) — round 1 gave both the
 * same width. Full reasoning: `design/notes/RecipeIngredientRow.md`.
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
  /** Removes this row (#166) — every row carries the trailing delete Button, matching every real data row in the fetched node (only the separate label-only header row has none, and that's not a row this component renders on its own). */
  onRemove: () => void;
  /** Accessible name for the delete Button. */
  removeLabel: string;
  /** Disables the delete Button without hiding it — Figma never draws a "last remaining row" state, so the caller (RecipePanel.tsx) disables removal at exactly one row rather than letting the list go empty. */
  removeDisabled?: boolean;
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
  removeDisabled,
  className,
}: RecipeIngredientRowProps) {
  const selectOptions = unitOptions.map((option) => ({ value: option.code, label: option.label }));

  return (
    // spacing-flag: `gap-2` — this component has no Figma node to bind
    // against (see "Why no design/figma-map.json entry" in
    // design/notes/RecipeIngredientRow.md).
    <div className={cn("flex w-full items-start gap-2", className)}>
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
      <div className="w-[72px] shrink-0">
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
      {/* Figma's data rows are `alignItems: center` (node 4025:10818), so the
          40px Button centres against the field BOX, not the whole column —
          row 1 also stacks a label above it. `self-stretch` (overriding the
          row's `items-start`) gives this column the row's full height, the
          invisible spacer consumes exactly the label block InputField renders
          (text-base font-semibold + the gap-2 below it), and `flex-1` leaves
          the box's own height for `items-center` to centre in. Measured, not
          assumed: hard-coding the box height gets it 1px off, since the box's
          border-box includes its 1px border. */}
      {/* spacing-flag: `gap-2` — same reasoning as the root row above (no
          Figma node for this component). design/notes/RecipeIngredientRow.md. */}
      <div className="flex shrink-0 flex-col gap-2 self-stretch">
        {showLabels ? (
          <span aria-hidden="true" className="invisible text-base font-semibold">
            &nbsp;
          </span>
        ) : null}
        <div className="flex flex-1 items-center">
          <Button
            variant="destructive"
            icon="Trash"
            aria-label={removeLabel}
            onClick={onRemove}
            disabled={removeDisabled}
          />
        </div>
      </div>
    </div>
  );
}
