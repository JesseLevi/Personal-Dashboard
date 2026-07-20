// figma: node-id=3628:67
import clsx from "clsx";
import { Icon } from "../atoms/Icon";

/**
 * Molecule/Card-content/Recipe — Figma component "Card-content/Recipi"
 * (node-id 3628:67, Molecules section; Figma's spelling "Recipi" is
 * corrected to "Recipe" in code per `design/figma-map.json`).
 *
 * Slots into the `Card` molecule's SLOT "Type" (a `Card-content/*` variant
 * is the card's content). Depends only on the `Icon` atom — the fetched
 * node contains no `Tag` instance, so none is composed here (ticket #19's
 * "Tag/Icon atoms as the design dictates" resolves to Icon-only).
 *
 * Figma structure, mirrored 1:1:
 *   root (row, gap-4, hug height, contextual width -> w-full)
 *   ├─ FRAME "Thumbnail"      — 96x96 IMAGE fill, radius 4px -> `imageUrl`/`imageAlt`
 *   └─ FRAME "Name + time"    — column, stretch height, centered, gap-2, fill
 *      ├─ TEXT                — recipe name -> `name` (text-base/semibold, `text`)
 *      └─ FRAME "Time"        — row, gap-2, hug
 *         ├─ IMAGE-SVG "Icon" — verified by rendered path (see Icon.tsx doc
 *         |                     comment) as lucide's `Timer`, not name alone
 *         └─ TEXT             — duration -> `duration` (text-sm/semibold, `text-muted`)
 *
 * Figma property -> code:
 * - Thumbnail IMAGE fill -> `imageUrl` (required; recipe photos are dynamic
 *   content, so there is nothing to bake in). Plain `<img>`, not `next/image`
 *   — this is a presentational Server Component with no client boundary, and
 *   `next/image` would additionally require registering the (not-yet-known)
 *   recipe-photo host in `next.config.ts`'s `images.remotePatterns`, an
 *   infra decision out of scope for a leaf molecule.
 * - TEXT "Amandel Pasta" -> `name` (required).
 * - TEXT "20 min" -> `duration` (required). Rendered as caller-supplied
 *   content, same pattern as `Card`'s `title` — this molecule does not
 *   format or localize a unit, so no i18n keys are needed here (there is no
 *   fixed UI string, only recipe data passed through).
 * - DEVIATION (flagged, not silently copied): the fetched "20 min" TEXT node
 *   has an authored *fixed* width of 92px. That number is sized to the
 *   sample string, not a deliberate content-independent constraint — a
 *   longer duration (e.g. "1 uur 30 min") would clip. Rendered at natural
 *   width instead, same category of call as Button's documented Figma
 *   auto-layout drift.
 *
 * No variant/state axis on this node (only text + an image slot), so no CVA
 * — `clsx` merges the caller's `className`, same as `Card`/`Step`.
 *
 * Colours read from the fetched node, no token gaps: name fill (stone-950)
 * -> `text-text`; duration fill + icon stroke (stone-500) -> `text-text-muted`.
 * `text-base/semibold` / `text-sm/semibold` textStyles -> their matching
 * Tailwind class pairs per `design/tokens.json`.
 */
export interface CardContentRecipeProps {
  /** Figma "Thumbnail" IMAGE fill — recipe photo URL. */
  imageUrl: string;
  /** Accessible name for the thumbnail. Defaults to `name` when omitted. */
  imageAlt?: string;
  /** Figma TEXT "Amandel Pasta" — recipe name. */
  name: string;
  /** Figma TEXT "20 min" — already-formatted duration, caller-supplied content (not formatted/localized here). */
  duration: string;
  className?: string;
}

export function CardContentRecipe({
  imageUrl,
  imageAlt,
  name,
  duration,
  className,
}: CardContentRecipeProps) {
  return (
    <div className={clsx("flex w-full gap-4", className)}>
      <img
        src={imageUrl}
        alt={imageAlt ?? name}
        className="h-24 w-24 shrink-0 rounded object-cover"
      />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <p className="w-full text-base font-semibold text-text">{name}</p>
        <div className="flex items-center gap-2">
          <Icon name="Timer" className="text-text-muted" />
          <p className="text-sm font-semibold text-text-muted">{duration}</p>
        </div>
      </div>
    </div>
  );
}
