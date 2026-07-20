// figma: node-id=3626:4515
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

/**
 * Atom/Tag — small pill/label. Figma component set "Tag" (node-id 3626:4515),
 * variant axis Color = { Grey, Red, Yellow, Green, Blue }.
 *
 * The CVA prop is named `color` to mirror the Figma axis 1:1. These color
 * names happen to line up with the project's priority semantic tokens
 * (urgent/medium/mid/low) — flagged in the PR for reviewer input on whether
 * a priority-named prop would read better at call sites than a color-named one.
 */
const tagVariants = cva(
  "inline-flex items-center gap-2 px-3 h-10 rounded-lg text-base font-semibold",
  {
    variants: {
      color: {
        grey: "bg-surface-muted text-text-muted",
        red: "bg-priority-urgent-bg text-priority-urgent",
        yellow: "bg-priority-medium-bg text-priority-medium",
        green: "bg-priority-low-bg text-priority-low",
        blue: "bg-priority-mid-bg text-priority-mid",
      },
    },
    defaultVariants: {
      color: "grey",
    },
  },
);

export interface TagProps extends VariantProps<typeof tagVariants> {
  children: ReactNode;
  className?: string;
}

export function Tag({ color, children, className }: TagProps) {
  return (
    <span className={tagVariants({ color, className })}>{children}</span>
  );
}
