// figma: node-id=4164:23681 (Card on "Add recipi dropdown 03/Desktop" 4164:23673, mobile 4164:23787)
import { cn } from "@/lib/ui/cn";

/**
 * Molecule/Card-content/Recipe skeleton — the placeholder card an import
 * shows at the top of its column while `recipes.import_status = 'importing'`.
 * Same 96px thumbnail slot as `CardContentRecipe`, plus two bars standing in
 * for name and time (152x26 and 96x26 in the fetched node). The surfaces
 * breathe with the shared skeleton animation (`--animate-breathe`). `label`
 * is the single accessible announcement. Measurements and the unbound
 * bar fill/radius: design/notes/CardContentRecipeSkeleton.md.
 */
export interface CardContentRecipeSkeletonProps {
  /** Accessible status text (next-intl, "Recept wordt geïmporteerd..."). */
  label: string;
  className?: string;
}

const BREATHE = "animate-breathe motion-reduce:animate-none";

export function CardContentRecipeSkeleton({ label, className }: CardContentRecipeSkeletonProps) {
  return (
    <div role="status" className={cn("flex w-full gap-inline-lg", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={cn("h-24 w-24 shrink-0 rounded-card-inner bg-surface-primary", BREATHE)} />
      <div aria-hidden="true" className="flex flex-1 flex-col justify-center gap-stack-xs">
        <div className={cn("h-6.5 w-38 rounded-card-inner bg-surface-primary", BREATHE)} />
        <div className={cn("h-6.5 w-24 rounded-card-inner bg-surface-primary", BREATHE)} />
      </div>
    </div>
  );
}
