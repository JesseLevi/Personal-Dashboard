// figma: node-id=3727:4021
import clsx from "clsx";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
import { Tag } from "../atoms/Tag";

/**
 * Molecule/Card-content/Ingredient — Figma component set "Card-content/Ingredient"
 * (node-id 3727:4021, Molecules section).
 * `Checkbox` axis (None/Unchecked/Checked) -> `checked?: boolean` (omit = None;
 * `true` also dims content to `opacity-40`).
 * `State` axis (Default/Active/Delete) -> CSS: Active is `:active` only (node
 * has no Hover — see design/notes/CardContentIngredient.md); Delete -> presence
 * of `onDelete` (requires `deleteLabel`), rendering an unconditional pill with
 * the Trash `Button` as a sibling, not a hover-gated child.
 * — see design/notes/CardContentIngredient.md for full token/measurement detail.
 */
export interface CardContentIngredientBaseProps {
  /** Ingredient name (Figma TEXT "Banana"). */
  name: string;
  /** Quantity text, rendered via the neutral Atom/Tag (Figma TEXT "300 gr"). */
  quantity: string;
  /**
   * Figma `Checkbox` variant axis (None/Unchecked/Checked). Omit for
   * `Checkbox=None` (no checkbox rendered). Pass `false`/`true` for
   * Unchecked/Checked — `true` also dims the ingredient content to 40%
   * opacity, matching the fetched `Checkbox=Checked` frame.
   */
  checked?: boolean;
  /** Forwarded to the Checkbox atom's `onClick`; ignored when `checked` is omitted. */
  onCheckedToggle?: () => void;
  className?: string;
}

/**
 * Figma `State=Delete` -> presence of `onDelete` renders a destructive
 * icon-only Trash Button beside the row. Icon-only requires an explicit,
 * already-translated `deleteLabel`.
 */
export type CardContentIngredientProps =
  | (CardContentIngredientBaseProps & {
      onDelete?: undefined;
      deleteLabel?: never;
    })
  | (CardContentIngredientBaseProps & {
      onDelete: () => void;
      deleteLabel: string;
    });

export function CardContentIngredient({
  name,
  quantity,
  checked,
  onCheckedToggle,
  onDelete,
  deleteLabel,
  className,
}: CardContentIngredientProps) {
  const content = (
    <div
      className={clsx(
        "flex w-full items-center justify-between",
        checked && "opacity-40",
      )}
    >
      <p className="text-base font-semibold text-text">{name}</p>
      <Tag variant="neutral">{quantity}</Tag>
    </div>
  );

  const checkbox = checked !== undefined && (
    <Checkbox checked={checked} aria-label={name} onClick={onCheckedToggle} />
  );

  if (onDelete) {
    // State=Delete: pill fill/radius/padding are unconditional, not a pointer
    // state — see design/notes/CardContentIngredient.md.
    return (
      <div
        className={clsx(
          "flex w-full items-center justify-end gap-2",
          className,
        )}
      >
        <div className="flex w-full items-center gap-5 rounded-3xl bg-surface-raised py-3 pl-3 pr-4">
          {content}
          {checkbox}
        </div>
        <Button
          variant="destructive"
          icon="Trash"
          aria-label={deleteLabel}
          onClick={onDelete}
        />
      </div>
    );
  }

  // State=Default/Active: the row IS the pill, highlight only on :active
  // (node has no Hover — design/notes/CardContentIngredient.md).
  // pl-3/pr-3/py-3 must stay split, not px-3: active:pr-4 overrides the same
  // longhand only if the base uses that longhand too (see notes file).
  return (
    <div
      className={clsx(
        "flex w-full items-center gap-5 rounded-3xl pl-3 pr-3 py-3 transition-colors active:bg-surface-raised active:pr-4",
        className,
      )}
    >
      {content}
      {checkbox}
    </div>
  );
}
