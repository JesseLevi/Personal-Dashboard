// figma: node-id=3727:4021
import clsx from "clsx";
import { Button } from "../atoms/Button";
import { Checkbox } from "../atoms/Checkbox";
import { Tag } from "../atoms/Tag";

/**
 * Molecule/Card-content/Ingredient — Figma component set "Card-content/Ingredient"
 * (node-id 3727:4021, Molecules section). Renders one shopping-list ingredient
 * row: name + quantity, with an optional Checkbox atom and an optional
 * destructive delete affordance.
 *
 * Figma variant axes, fetched via MCP (component set has two axes: `Checkbox`
 * and `State`):
 *
 * - `Checkbox` (None / Unchecked / Checked) -> the optional `checked` prop.
 *   Omitting it entirely reproduces `Checkbox=None` (no Checkbox atom
 *   rendered at all — sampled in the "State=Default, Checkbox=None" frame).
 *   Passing `false`/`true` renders the Checkbox atom Unchecked/Checked.
 *   `Checkbox=Checked` also dims the name+tag content to 40% opacity in the
 *   fetched node (sampled on the "Ingredient + quantity" frame) — reproduced
 *   here as `opacity-40` on that same wrapper when `checked` is `true`.
 *   Accessible name for the Checkbox atom is the ingredient's own `name`
 *   (dynamic content, not chrome UI text, so no next-intl entry is needed
 *   for it — same reasoning Card.tsx applies to its own dynamic props).
 *
 * - `State` (Default / Active / Delete) is NOT modelled as a CVA prop, per
 *   CLAUDE.md's "State (Hover/Active) becomes CSS pseudo-classes, never
 *   props" rule. Reading the three fetched frames together: Default has no
 *   fill; Active adds a `surface-raised` pill background (rounded 24px,
 *   i.e. Tailwind's `rounded-3xl`, matching the fetched node's own
 *   `borderRadius: 24` literally rather than eyeballing a full pill from the
 *   screenshot) with 4px extra right padding; Delete is the *same* Active
 *   pill plus a separate destructive icon-only Button (Trash) beside it,
 *   gap 8px. Since Active's highlighted background exists as its own
 *   variant independent of the delete button, and Figma's own naming
 *   history in this codebase already treats "Active" loosely (see Atom/
 *   Button's "Selected was renamed from Active" note), this is read as: the
 *   pill highlight is a `hover`/`focus-within` pseudo-class on the row
 *   (works for pointer AND keyboard users, unlike a hover-only reveal),
 *   and the delete button's *presence* is the real structural difference,
 *   controlled by the `onDelete` prop (booleans -> optional props, same
 *   idiom as `Button`'s `icon`). Deliberately NOT hidden until hover: an
 *   always-hidden-until-hover delete affordance is a known accessibility
 *   trap for touch/keyboard users and Figma's own Delete frame renders the
 *   button plainly visible, so no such hiding is invented.
 *
 * - The Trash delete Button reuses `Atom/Button` exactly as fetched
 *   (`variant="destructive" icon="Trash"`, no text) — its instance padding
 *   in the fetched node (`0px 4px 0px 8px`) matches Button.tsx's own
 *   documented icon-only recipe (`pl-2 pr-1` root + icon wrapper `pr-1`)
 *   pixel-for-pixel, so no override was needed.
 *
 * - Structure simplification: Figma gives the Delete variant its own outer
 *   wrapping frame (`justifyContent: flex-end`, gap 8) that the other
 *   variants don't have (their outer frame *is* the content panel). This
 *   component always renders that outer flex wrapper (gap-2, i.e. 8px) and
 *   conditionally renders the delete Button as its second child — one extra,
 *   purely-layout `<div>` with no fill/border when `onDelete` is omitted, no
 *   visible difference from the fetched Default/Active frames. Chosen for
 *   code simplicity over exact DOM-node parity (CLAUDE.md priority #6).
 *
 * Text style: `text-base/semibold` (Figma) -> `text-base font-semibold`
 * (design/tokens.json typography map). Name fill stone-950 -> `text-text`.
 * Quantity is rendered via `Atom/Tag` `variant="neutral"` — the fetched
 * nested Tag instance's fill/text primitives are an exact match for Tag's
 * existing `neutral` variant (`surface-muted`/`text-muted`), no token gap.
 * The fetched hex values are recorded in `design/figma-map.json` only.
 *
 * `onDelete` requires `deleteLabel` (a caller-supplied, already-translated
 * string) because the delete Button is icon-only — same discriminated-union
 * idiom `Button`/`ButtonToggle` use for their own icon-only `aria-label`.
 * Per CLAUDE.md, this leaf molecule never calls next-intl itself (it must
 * stay importable by a Client Component composer without pulling in a
 * server-only i18n call, same reasoning as `ButtonToggle`'s `defaultLabel`);
 * the Ladle story's demo delete label is instead sourced from
 * `messages/en.json` / `messages/nl.json` -> `components.cardContentIngredient.deleteLabel`.
 *
 * Stays a Server Component: no internal state, no `"use client"`. Interactive
 * wiring (`onCheckedToggle`, `onDelete`) is fully composer-owned, same
 * controlled idiom as `Checkbox` itself.
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
 * already-translated `deleteLabel` (see the class doc comment above).
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
  return (
    <div className={clsx("flex w-full items-center gap-2", className)}>
      <div className="flex w-full items-center gap-5 rounded-3xl p-3 transition-colors hover:bg-surface-raised hover:pr-4 focus-within:bg-surface-raised focus-within:pr-4">
        <div
          className={clsx(
            "flex w-full items-center justify-between",
            checked && "opacity-40",
          )}
        >
          <p className="text-base font-semibold text-text">{name}</p>
          <Tag variant="neutral">{quantity}</Tag>
        </div>
        {checked !== undefined && (
          <Checkbox
            checked={checked}
            aria-label={name}
            onClick={onCheckedToggle}
          />
        )}
      </div>
      {onDelete && (
        <Button
          variant="destructive"
          icon="Trash"
          aria-label={deleteLabel}
          onClick={onDelete}
        />
      )}
    </div>
  );
}
