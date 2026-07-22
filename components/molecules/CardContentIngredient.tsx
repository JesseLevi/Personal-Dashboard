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
 *   props" rule. The fetched component set has only these three frames —
 *   **no Hover** — so per docs/design-tokens.md's "if Figma defines no
 *   variation for a role in some state, don't invent one" and the precedent
 *   tickets #56 (`Atom/Button`) and #58 (`Atom/Input-field`) set for these
 *   exact state names, `Active` means "currently being pressed" and maps to
 *   CSS `:active`, never `:hover`/`:focus-within`. Reading the three frames
 *   together: Default has no fill; Active adds a `surface-raised` pill
 *   background (rounded 24px, i.e. Tailwind's `rounded-3xl`, matching the
 *   fetched node's own `borderRadius: 24` literally rather than eyeballing a
 *   full pill from the screenshot) with 4px extra right padding, both live
 *   only on `:active`; Delete replaces that *pointer-state* pill with an
 *   **unconditional** one — verified against the live node
 *   (`State=Delete, Checkbox=Unchecked`, node 3727:4378): the
 *   `Molecule/Ingredient` frame carries the same stone-200 fill as Active
 *   (-> `surface-raised`), `borderRadius 24px`, `padding 12px 16px 12px 12px`
 *   with no pointer-state
 *   qualifier at all, and the Trash `Button` sits **outside** that frame as
 *   a sibling in an outer `justifyContent: flex-end` row (gap 8px). So the
 *   pill fill/radius/padding is a structural, always-on property of the
 *   Delete case, not a hover reveal — the delete button's *presence* is
 *   still the trigger for that structural branch, controlled by the
 *   `onDelete` prop (booleans -> optional props, same idiom as `Button`'s
 *   `icon`). Deliberately NOT hidden until press: an always-hidden delete
 *   affordance is a known accessibility trap for touch/keyboard users and
 *   Figma's own Delete frame renders the button plainly visible, so no such
 *   hiding is invented.
 *
 *   **Open question** (recorded in docs/design-tokens.md, not resolved by
 *   guessing): node 3727:4021 defines no Hover state, so an ingredient row
 *   has no pointer (mouse-over, as opposed to press) affordance — the same
 *   class of gap already recorded there for `Atom/Button`'s Transparent
 *   style, which `Atom/Button-toggle`'s segments inherit (they render as
 *   `Button variant="transparent"`). Needs a design answer, not a code
 *   guess.
 *
 * - The Trash delete Button reuses `Atom/Button` exactly as fetched
 *   (`variant="destructive" icon="Trash"`, no text). RE-VERIFIED for ticket
 *   #75 against re-fetched node 3727:4378: the earlier claim here (root
 *   padding `0px 4px 0px 8px` "matches pixel-for-pixel, no override needed")
 *   was suspect and is now confirmed WRONG for the reason it gave — it only
 *   compared root padding, not the whole footprint. The fetched instance's
 *   real total is root `pl` (8) + icon frame (`24` icon + its own `pr` 4 =
 *   28) + root `pr` (4) = **40x40 square** (icon frame padding is
 *   unconditional in Figma, not gated by whether text follows), while
 *   `Button.tsx`'s icon-only `size="default"` measured 36x40 pre-fix
 *   (`pl-2` (8) + Icon's 24px + `pr-1` (4), the icon wrapper's own `pr-1`
 *   stripped for icon-only per ticket #69) — the same 4px shortfall
 *   `Card-container` had. No override was ever added here, so this
 *   component silently inherited the atom's bug. Fixed at the atom (ticket
 *   #75): icon-only `size="default"` now resolves to a structural
 *   `size-10 justify-center` internally, which now genuinely matches this
 *   node's 40x40 — this molecule needed no change of its own.
 *
 * - Structure mirrors Figma exactly rather than trading DOM parity for code
 *   simplicity: the Default/Active case renders a single row (the row *is*
 *   the pill, matching Figma's own frame there), and the Delete case adds
 *   the outer `justify-end` wrapper (gap-2, i.e. 8px) with the pill as one
 *   child and the Trash Button as its sibling — because the two cases now
 *   have genuinely different fill semantics (pointer-state vs. unconditional),
 *   collapsing them into one shared wrapper would have re-introduced the
 *   hover-only bug this ticket fixes.
 *
 * - Padding uses explicit longhand (`pl-3 pr-3 py-3`, never the `px-3`
 *   shorthand) because `px-*` emits `padding-inline`, a different longhand
 *   from `pr-*`'s `padding-right` — both affect the right side in LTR, but
 *   as two distinct declarations the winner would be decided by Tailwind's
 *   utility emission order, not by one overriding the other. Using `pr-3`
 *   in the base means the `:active` variant's `pr-4` overrides the
 *   identical longhand property. `Atom/Button`'s own doc comment flags the
 *   general version of this fragility (`h-8`/`h-10` on the same property,
 *   same specificity); splitting the shorthand here is the same defensive
 *   move applied to padding. `transition-colors`
 *   only animates colour, not padding/spacing, so the row visibly shifts
 *   4px the instant `:active` fires rather than easing — that shift is in
 *   the fetched node (the padding literally changes), so it is kept
 *   deliberately, not smoothed away.
 *
 * Text style: `text-base/semibold` (Figma) -> `text-base font-semibold`
 * (design/tokens.json typography map). Name fill stone-950 -> `text-text`.
 * Quantity is rendered via `Atom/Tag` `variant="neutral"` — the fetched
 * nested Tag instance's fill/text primitives are an exact match for Tag's
 * existing `neutral` variant (`surface-muted`/`text-muted`), no token gap.
 * The fetched hex values are recorded in `design/notes/CardContentIngredient.md` only.
 *
 * `onDelete` requires `deleteLabel` (a caller-supplied, already-translated
 * string) because the delete Button is icon-only — same discriminated-union
 * idiom `Button`/`ButtonToggle` use for their own icon-only `aria-label`
 * (`ButtonToggle`'s own required-label prop is `aria-label`/`aria-labelledby`
 * since #65, not the pre-#65 `defaultLabel` this comment used to cite). Per
 * CLAUDE.md, this leaf molecule never calls next-intl itself, so it stays
 * importable by a Client Component composer without pulling in a
 * server-only i18n call; the Ladle story's demo delete label is instead
 * sourced from `messages/en.json` / `messages/nl.json` ->
 * `components.cardContentIngredient.deleteLabel`.
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
    // State=Delete (node 3727:4378): the pill's fill/radius/padding are
    // unconditional here, not a pointer state — see the class doc comment.
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

  // State=Default/Active: the row IS the pill, and the highlight only
  // appears on :active (see the class doc comment for why not :hover).
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
