// figma: node-id=3626:4515
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * Atom/Tag — small pill/label. Figma component set "Tag" (node-id 3626:4515).
 *
 * Figma's "Color" variant axis (Grey/Red/Blue/Green/Yellow) maps to a
 * semantic `variant` prop matching the card `priority` enum instead of
 * color names: Grey→neutral, Red→urgent, Blue→medium, Green→low. `mid`
 * is retired (#97) — Yellow carries no priority meaning and keeps its own
 * non-priority name, `highlight`. See design/notes/Tag.md.
 */
const tagVariants = cva(
  "inline-flex items-center gap-2 px-3 h-10 rounded-lg text-base font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-muted",
        urgent: "bg-priority-urgent-bg text-priority-urgent",
        medium: "bg-priority-medium-bg text-priority-medium",
        low: "bg-priority-low-bg text-priority-low",
        highlight: "bg-tag-highlight-bg text-tag-highlight",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface TagProps extends VariantProps<typeof tagVariants> {
  children: ReactNode;
  className?: string;
}

export function Tag({ variant, children, className }: TagProps) {
  return (
    <span className={tagVariants({ variant, className })}>{children}</span>
  );
}
