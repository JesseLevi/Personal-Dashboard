// design: Claude-designed on request (#318)
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms/Button";

/**
 * Molecule/Card-content/Recipe, failed import — shown in the Card slot of a
 * recipe whose `import_status` is `failed`. No Figma node: composed from the
 * existing `Button` (filled retry, destructive delete) and semantic text
 * tokens; the title is the source host, the reason a short i18n string the
 * caller maps from `recipes.import_error`. Reused components and tokens:
 * design/notes/CardContentRecipeFailed.md.
 */
export interface CardContentRecipeFailedProps {
  /** Source host of the link, plain text (never rendered as markup). */
  name: string;
  /** Short reason, already translated from `import_error`. */
  reason: string;
  /** Heading above the reason ("Import mislukt"). */
  title: string;
  retryLabel: string;
  deleteLabel: string;
  onRetry: () => void;
  onDelete: () => void;
  /** Disables both buttons while an action is running. */
  disabled?: boolean;
  className?: string;
}

export function CardContentRecipeFailed({
  name,
  reason,
  title,
  retryLabel,
  deleteLabel,
  onRetry,
  onDelete,
  disabled,
  className,
}: CardContentRecipeFailedProps) {
  return (
    <div className={cn("flex w-full flex-col gap-stack-sm", className)}>
      <div className="flex flex-col">
        <p className="text-base font-semibold text-priority-urgent">{title}</p>
        <p className="break-words text-sm font-semibold text-text-secondary">{name}</p>
      </div>
      <p className="text-base font-semibold text-text-primary">{reason}</p>
      <div className="flex flex-wrap gap-inline-sm">
        <Button variant="filled" onClick={onRetry} disabled={disabled}>
          {retryLabel}
        </Button>
        <Button variant="destructive" icon="Trash" onClick={onDelete} disabled={disabled}>
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}
