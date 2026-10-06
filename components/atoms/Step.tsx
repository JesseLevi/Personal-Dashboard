// figma: node-id=3727:3208
import { cn } from "@/lib/ui/cn";
import type { HTMLAttributes, ReactNode } from "react";

export interface StepProps extends HTMLAttributes<HTMLSpanElement> {
  /** Step number/label rendered inside the badge (Figma's single TEXT child, e.g. "1"). */
  children: ReactNode;
}

/**
 * Atom/Step — presentational step badge (Server Component). Figma
 * "Atoms/Steps" (node-id 3727:3208), single fixed component, no variant/
 * state axis — a 32x32 circular badge, centered content. History: `design/notes/Step.md`.
 */
export function Step({ children, className, ...props }: StepProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-semibold text-text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}
