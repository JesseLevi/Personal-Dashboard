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
  // `gap-2` stays raw (#205): the fetched node binds this itemSpacing to
  // `spacing/mini`, a Figma variable outside the Semantics/Responsive
  // collection this pipeline mirrors — no matching semantic token exists.
  // Value (8px) is never inferred onto `inline-sm`/`component-sm`, which
  // share the same pixels but are genuinely different Figma variables. See
  // design/notes/Tag.md.
  "inline-flex items-center gap-2 px-component-md h-10 rounded-control text-base font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-primary text-text-secondary",
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
