// figma: node-id=3695:3941
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Molecule/Card-content/Step — Figma component "Card-content/Step"
 * (node-id 3695:3941, Molecules section).
 * TEXT -> `text`; boolean "Ingrediënten tags" -> `withIngredientTags?`
 * (default `true`, gates SLOT visibility); SLOT "Slot" -> `children`.
 * No variant/state axis; `clsx` merges className.
 * Step *number* badge is NOT rendered here — it's `Card`'s own `step` prop
 * (see design/notes/Card.md), composed side by side with this molecule.
 * — see design/notes/CardContentStep.md
 */
export interface CardContentStepProps {
  /** Figma TEXT — the step's instruction copy (dynamic recipe content, caller-supplied). */
  text: string;
  /**
   * Figma boolean "Ingrediënten tags" (default `true`) — shows/hides the
   * SLOT "Slot" region. Purely a visibility gate; the slot's actual content
   * is `children` (this node's SLOT has no sample Tag instance, so no
   * `Atom/Tag` is rendered internally — see design/notes/CardContentStep.md).
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
    <div className={clsx("flex w-full flex-col items-stretch gap-stack-lg p-component-md", className)}>
      <p className="w-full text-sm font-semibold text-text-primary">{text}</p>
      {withIngredientTags && (
        <div className="flex w-full flex-wrap gap-inline-sm">{children}</div>
      )}
    </div>
  );
}
