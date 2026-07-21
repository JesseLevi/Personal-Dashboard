// figma: node-id=3695:3941
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Molecule/Card-content/Step — Figma component "Card-content/Step"
 * (node-id 3695:3941, Molecules section). Renders one recipe-step's
 * instruction text, with an optional row of ingredient tags below it.
 *
 * Slots into the `Card` molecule's SLOT "Type" (a `Card-content/*` variant
 * is the card's content), the same composition CardContentRecipe/Ingredient
 * use. The step *number* badge is NOT rendered here: `Card`'s own `step`
 * prop already composes a `Molecule/Step` instance at the Card level (see
 * `design/figma-map.json`'s "Card" entry — "Step (bool) -> step?: ReactNode
 * composed via the existing Step molecule instance"), so a Card showing a
 * numbered step composes `Step` and `Card-content/Step` side by side, not
 * one nested inside the other. This ticket's brief ("uses the Step molecule
 * + Tag atom") describes that pairing at the Card level, not this leaf
 * node's own contents.
 *
 * Figma structure, mirrored 1:1 (the fetched node has exactly two children,
 * both fetched directly — no nesting was assumed):
 *   root (column, p-3, items-stretch, gap-4, hug height, contextual width -> w-full)
 *   ├─ TEXT                    — step instruction -> `text` (text-sm/semibold, text)
 *   └─ SLOT "Slot" (row, wrap, gap-2, fill width, hug height)
 *        visibility bound to boolean "Ingrediënten tags" -> `withIngredientTags`
 *
 * Figma property -> code:
 * - TEXT "Mash the banana..." -> `text` (required, caller-supplied step
 *   copy — dynamic recipe content, not fixed UI chrome, so no i18n key is
 *   needed here, same reasoning CardContentRecipe's `name`/`duration` use).
 * - Boolean "Ingrediënten tags" (Figma default `true`) -> optional
 *   `withIngredientTags` prop, defaulting to `true` to match. Per CLAUDE.md
 *   ("Figma booleans -> optional props"), this purely gates the SLOT
 *   region's visibility.
 * - SLOT "Slot" -> `children`, per CLAUDE.md ("Figma SLOT nodes -> children/
 *   named slots"). IMPORTANT (flagged, not silently resolved): the fetched
 *   node's SLOT has no nested instance at all — downloading the node's own
 *   image confirms it renders empty even though the boolean's default is
 *   `true` (no sample Tag pills anywhere in the component). Unlike
 *   `Card-content/Ingredient` (node 3727:4021), which nests a real `Tag`
 *   instance this file could read colours/variant from, there is nothing
 *   here to copy. So this molecule does not import or render `Atom/Tag`
 *   itself — the composer fills the slot with `Tag` instances (e.g.
 *   `variant="neutral"`, matching the tag styling `Card-content/Ingredient`
 *   already established, since no other precedent exists in this node).
 *   This is the same category of gap CardContentRecipe's doc comment flags
 *   for its own missing Tag instance, just resolved as
 *   children-slot-not-fixed-content instead of omitted entirely, because
 *   this node's SLOT type explicitly asks for composer content.
 *
 * No variant/state axis on this node (one boolean + text + a slot), so no
 * CVA — `clsx` merges the caller's `className`, same as `Step`/
 * `CardContentRecipe`.
 *
 * Colours read from the fetched node, no token gaps: TEXT fill (stone-950)
 * -> `text-text`. `text-sm/semibold` textStyle -> its matching Tailwind
 * class pair per `design/tokens.json`.
 *
 * No icons in this node — rule 3's shape-verification step doesn't apply.
 *
 * Stays a Server Component: no internal state, no `"use client"`. Nothing
 * here is interactive; any interactivity on composer-supplied Tag children
 * (if ever added) is the composer's concern, not this leaf's.
 */
export interface CardContentStepProps {
  /** Figma TEXT — the step's instruction copy (dynamic recipe content, caller-supplied). */
  text: string;
  /**
   * Figma boolean "Ingrediënten tags" (default `true`) — shows/hides the
   * SLOT "Slot" region. Purely a visibility gate; the slot's actual content
   * is `children` (see the class doc comment for why no Tag is rendered
   * internally).
   */
  withIngredientTags?: boolean;
  /** Figma SLOT "Slot" — composer-supplied ingredient `Atom/Tag` instances for this step. */
  children?: ReactNode;
  className?: string;
}

export function CardContentStep({
  text,
  withIngredientTags = true,
  children,
  className,
}: CardContentStepProps) {
  return (
    <div className={clsx("flex w-full flex-col items-stretch gap-4 p-3", className)}>
      <p className="w-full text-sm font-semibold text-text">{text}</p>
      {withIngredientTags && (
        <div className="flex w-full flex-wrap gap-2">{children}</div>
      )}
    </div>
  );
}
