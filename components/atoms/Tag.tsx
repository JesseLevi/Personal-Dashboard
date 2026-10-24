// figma: node-id=3626:4515
import { cn } from "@/lib/ui/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Tag — small pill/label. Figma component set "Tag" (node-id 3626:4515).
 *
 * Figma's "Color" variant axis (Grey/Red/Blue/Green/Yellow) maps to a
 * semantic `variant` prop matching the card `priority` enum instead of
 * color names: Grey→neutral, Red→urgent, Blue→medium, Green→low. `mid`
 * is retired (#97) — Yellow carries no priority meaning and keeps its own
 * non-priority name, `highlight`. Size (24 px, `text-xs`) is a deliberate
 * deviation from the Figma node; see design/notes/Tag.md.
 */
const tagVariants = cva(
  "inline-flex h-6 items-center gap-inline-xs px-component-sm rounded-control text-xs font-semibold",
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
  /** Leading icon, sized by the Tag so it matches the 12 px label. */
  icon?: IconName;
  className?: string;
}

export function Tag({ variant, icon, children, className }: TagProps) {
  return (
    <span className={cn(tagVariants({ variant }), className)}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}
