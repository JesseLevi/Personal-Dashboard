// figma: node-id=3650:1297
import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon } from "../atoms/Icon";
import { Button } from "../atoms/Button";

/**
 * Organism/Card-container — Figma component "Card-container" (node-id
 * 3650:1297, Organisms section). This is the kanban column: a header row
 * (category icon + name + count, plus two icon-only action buttons) above a
 * scrollable stack of `Card` instances.
 *
 * Figma structure, mirrored 1:1 (first file in `components/organisms/` —
 * per CLAUDE.md, an organism may import molecules/atoms, never the reverse):
 *   root (column, bg stone-200, radius 24px, padding 0px 12px 12px)
 *   ├─ "Carousel details" (row, fill width, hug height, px-2, justify-between)
 *   │  ├─ "Info" (row, gap-4, hug width, fixed h-12)
 *   │  │  ├─ IMAGE-SVG "Icon/Croissant" — fixed, not a variant (see below)
 *   │  │  ├─ TEXT — `Name` prop -> `name` (text-base/semibold, text)
 *   │  │  └─ TEXT — `Hoeveelheid` prop -> `count` (text-base/semibold, text-muted)
 *   │  └─ "Edit" (row, gap-2, hug width, fixed h-12, justify-end)
 *   │     ├─ INSTANCE "Atom/Button" (Icon/Plus)  -> composed `Button`, not re-implemented
 *   │     └─ INSTANCE "Atom/Button" (Icon/Pencil) -> composed `Button`
 *   └─ SLOT "Content" (column, fill/fill, gap-2, justify-center)
 *      -> `children` (composer renders real `Card` instances here — the
 *         fetched node nests actual `Card` instances wrapping
 *         `Card-content/*` molecules, so callers must do the same rather
 *         than this component re-rendering Card's markup itself)
 *
 * Figma property -> code:
 * - `Name` (text, default "Ontbijt") -> required `name: string`.
 * - `Hoeveelheid` (text, default "4") -> required `count: string` (kept as a
 *   string, not coerced to number, same treatment `CardContentRecipe`'s
 *   `duration` gets — caller-supplied display text, not data this leaf
 *   formats).
 * - The header's `Croissant` icon and the two Edit buttons are NOT modelled
 *   as props: `componentPropertyDefinitions` on node 3650:1297 lists only
 *   `Name` and `Hoeveelheid`, so Figma defines no icon/action variant axis —
 *   per CLAUDE.md ("never invent a Figma state/prop that isn't in the
 *   fetched node"), the Croissant icon and the two actions are fixed chrome,
 *   not swappable per instance. A future ticket that adds a real Figma
 *   variant for the category icon should turn this into a prop then, not
 *   preemptively here.
 * - Icon-only Edit buttons are always rendered in the fetched node (not
 *   gated by a boolean), so their accessible names are required props
 *   (`addLabel`, `editLabel`) sourced from next-intl by the caller — this
 *   leaf stays a Server Component with no i18n import of its own, the same
 *   division of responsibility `CardContentIngredient`'s `deleteLabel`
 *   already established. `onAdd`/`onEdit` are optional handlers (wiring is
 *   fully composer-owned).
 * - SLOT "Content" -> required `children`.
 *
 * No variant/state axis on this node (only two text properties), so no CVA
 * — `clsx` merges the caller's `className`, same as `Card`/`Step`.
 *
 * Sizing: the root's own Figma sizing is `contextual` on both axes (it
 * takes on whatever a real parent — e.g. the not-yet-built `Carousel`
 * organism — gives it), so it is rendered `w-full` rather than a hardcoded
 * pixel width, the exact same call `Card.tsx`'s doc comment already made for
 * its own `contextual` width. The Content slot's Figma sizing is fill/fill;
 * translated as `flex-1` inside the column, matching how
 * `CardContentRecipe`'s own fill/fill "Name + time" frame was translated.
 *
 * Colours read from the fetched node, no token gaps: root fill stone-200 ->
 * `surface-raised`; Name fill stone-950 -> `text`; count fill stone-500 ->
 * `text-muted`. The Croissant icon carries no fill override on this
 * instance — fetched the icon component itself (node 3628:406) to confirm
 * its own baked-in stroke rather than guessing: stone-500, i.e. `text-muted`
 * (same role as the count text beside it, not the heading `Name`).
 * `text-base/semibold` textStyle -> `text-base font-semibold` per the
 * typography map in design/tokens.json.
 *
 * The two Edit buttons reuse `Atom/Button` exactly as fetched
 * (`variant="filled"`, icon-only, default size) — the fetched instance is
 * 40x40 with 0px/12px padding centered, which is pixel-identical to
 * Button.tsx's own documented icon-only default recipe (`pl-2 pr-1` root +
 * icon wrapper with no extra padding when there is no label = 8+24+4 = 40),
 * so no override/new size variant was needed.
 */
export interface CardContainerProps {
  /** Figma `Name` prop (default "Ontbijt") — column title. */
  name: string;
  /** Figma `Hoeveelheid` prop (default "4") — count shown beside the name. */
  count: string;
  /** Accessible label for the always-visible icon-only add button (composer-supplied, from next-intl). */
  addLabel: string;
  /** Forwarded to the add button's `onClick`. */
  onAdd?: () => void;
  /** Accessible label for the always-visible icon-only edit button (composer-supplied, from next-intl). */
  editLabel: string;
  /** Forwarded to the edit button's `onClick`. */
  onEdit?: () => void;
  /** Figma SLOT "Content" — the column's cards, typically `Card` instances wrapping `Card-content/*` molecules. */
  children: ReactNode;
  className?: string;
}

export function CardContainer({
  name,
  count,
  addLabel,
  onAdd,
  editLabel,
  onEdit,
  children,
  className,
}: CardContainerProps) {
  return (
    <div
      className={clsx(
        "flex w-full flex-col rounded-3xl bg-surface-raised px-3 pb-3",
        className,
      )}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex h-12 items-center gap-4">
          <Icon name="Croissant" className="text-text-muted" />
          <p className="text-base font-semibold text-text">{name}</p>
          <p className="text-base font-semibold text-text-muted">{count}</p>
        </div>
        <div className="flex h-12 items-center justify-end gap-2">
          <Button
            variant="filled"
            icon="Plus"
            aria-label={addLabel}
            onClick={onAdd}
          />
          <Button
            variant="filled"
            icon="Pencil"
            aria-label={editLabel}
            onClick={onEdit}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">
        {children}
      </div>
    </div>
  );
}
