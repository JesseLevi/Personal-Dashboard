// figma: node-id=3628:67
import clsx from "clsx";
import { Icon } from "../atoms/Icon";

/**
 * Molecule/Card-content/Recipe — Figma component "Card-content/Recipi"
 * (node-id 3628:67, Molecules section; Figma's spelling "Recipi" is
 * corrected to "Recipe" in code).
 * Thumbnail IMAGE fill -> `imageUrl`/`imageAlt`; TEXT "Amandel Pasta" -> `name`;
 * TEXT "20 min" -> `duration`. No Tag instance in this node (Icon-only).
 * No variant/state axis; `clsx` merges className.
 * DEVIATION: rendered at natural width, not Figma's fixed 92px on "20 min".
 * — see design/notes/CardContentRecipe.md
 */
export interface CardContentRecipeProps {
  /** Figma "Thumbnail" IMAGE fill — recipe photo URL. Optional: a recipe without a stored photo yet renders a `bg-surface-muted` placeholder square instead — a real, nullable state the fetched node doesn't draw (#124, design/notes/CardContentRecipe.md). */
  imageUrl?: string;
  /** Accessible name for the thumbnail. Decorative (`""`) by default since the recipe name is already rendered as adjacent text; pass an explicit value to override. Ignored when `imageUrl` is absent (the placeholder square is itself `aria-hidden`). */
  imageAlt?: string;
  /** Figma TEXT "Amandel Pasta" — recipe name. */
  name: string;
  /** Figma TEXT "20 min" — already-formatted duration, caller-supplied content (not formatted/localized here). Optional: `recipes.time_minutes` is nullable, so the row is omitted rather than showing invented text (#124, design/notes/CardContentRecipe.md). */
  duration?: string;
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
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={imageAlt ?? ""}
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          className="h-24 w-24 shrink-0 rounded object-cover"
        />
      ) : (
        <div aria-hidden="true" className="h-24 w-24 shrink-0 rounded bg-surface-muted" />
      )}
      <div className="flex flex-1 flex-col justify-center gap-2">
        <p className="w-full text-base font-semibold text-text">{name}</p>
        {duration && (
          <div className="flex items-center gap-2">
            <Icon name="Timer" className="text-text-muted" />
            <p className="text-sm font-semibold text-text-muted">{duration}</p>
          </div>
        )}
      </div>
    </div>
  );
}
