// figma: node-id=3626:4515
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * Atom/Tag — small pill/label. Figma component set "Tag" (node-id 3626:4515).
 *
 * Figma's "Color" variant axis (Grey/Red/Yellow/Green/Blue) maps to a
 * semantic `variant` prop matching the card `priority` enum instead of
 * color names: Grey→neutral, Red→urgent, Yellow→medium, Blue→mid, Green→low.
 */
const tagVariants = cva(
  "inline-flex items-center gap-2 px-3 h-10 rounded-lg text-base font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-muted",
        urgent: "bg-priority-urgent-bg text-priority-urgent",
        medium: "bg-priority-medium-bg text-priority-medium",
        mid: "bg-priority-mid-bg text-priority-mid",
        low: "bg-priority-low-bg text-priority-low",
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
