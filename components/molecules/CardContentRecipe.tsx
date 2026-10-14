// figma: node-id=3628:67
"use client";

import { cn } from "@/lib/ui/cn";
import { useImageFallback } from "@/lib/ui/image-fallback";
import { Icon } from "../atoms/Icon";

/**
 * Molecule/Card-content/Recipe — Figma component "Card-content/Recipi"
 * (node-id 3628:67, Molecules section; Figma's spelling "Recipi" is
 * corrected to "Recipe" in code).
 * Thumbnail IMAGE fill -> `imageUrl`/`imageAlt`; TEXT "Amandel Pasta" -> `name`;
 * TEXT "20 min" -> `duration`. No Tag instance in this node (Icon-only).
 * No variant/state axis; `cn` merges className.
 * DEVIATION: rendered at natural width, not Figma's fixed 92px on "20 min".
 * — see design/notes/CardContentRecipe.md
 */
export interface CardContentRecipeProps {
  /** Figma "Thumbnail" IMAGE fill — recipe photo URL. Optional: a recipe without a stored photo yet renders a `bg-surface-primary` placeholder square instead — a real, nullable state the fetched node doesn't draw (#124, design/notes/CardContentRecipe.md). */
  imageUrl?: string;
  /** Swapped in once if `imageUrl` fails to load (expired presigned URL); design/notes/CardContentRecipe.md. */
  imageFallbackUrl?: string;
  /** Accessible name for the thumbnail. Decorative (`""`) by default since the recipe name is already rendered as adjacent text; pass an explicit value to override. Ignored when `imageUrl` is absent (the placeholder square is itself `aria-hidden`). */
  imageAlt?: string;
  /** Figma TEXT "Amandel Pasta" — recipe name. */
  name: string;
  /** Figma TEXT "20 min" — already-formatted duration, caller-supplied content (not formatted/localized here). Optional: `recipes.time_minutes` is nullable, so the row is omitted rather than showing invented text (#124, design/notes/CardContentRecipe.md). */
  duration?: string;
  /** Claude-designed (#487): a 48px thumbnail and tighter text for lists beside the Agenda. Default is Figma's 96px card. */
  compact?: boolean;
  className?: string;
}

export function CardContentRecipe({
  imageUrl,
  imageFallbackUrl,
  imageAlt,
  name,
  duration,
  compact = false,
  className,
}: CardContentRecipeProps) {
  const image = useImageFallback(imageUrl ?? "", imageFallbackUrl);
  const thumbnail = compact ? "h-12 w-12" : "h-24 w-24";
  return (
    <div className={cn("flex w-full", compact ? "gap-inline-md" : "gap-inline-lg", className)}>
      {imageUrl ? (
        <img
          src={image.src}
          onError={image.onError}
          alt={imageAlt ?? ""}
          width={compact ? 48 : 96}
          height={compact ? 48 : 96}
          loading="lazy"
          decoding="async"
          className={cn("shrink-0 rounded-card-inner object-cover", thumbnail)}
        />
      ) : (
        <div aria-hidden="true" className={cn("shrink-0 rounded-card-inner bg-surface-primary", thumbnail)} />
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col justify-center", compact ? "gap-stack-xs" : "gap-stack-sm")}>
        <p className={cn("w-full font-semibold text-text-primary", compact ? "truncate text-sm" : "text-base")}>{name}</p>
        {duration && (
          // spacing-flag: `gap-2` stays raw (#205): "Time"'s itemSpacing (8px) has no
          // bound variable in the fetched node. See design/notes/CardContentRecipe.md.
          <div className="flex items-center gap-2">
            <Icon name="Timer" className="text-text-secondary" />
            <p className="text-sm font-semibold text-text-secondary">{duration}</p>
          </div>
        )}
      </div>
    </div>
  );
}
