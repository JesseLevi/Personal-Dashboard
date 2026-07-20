// figma: node-id=3727:3208
import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export interface StepProps extends HTMLAttributes<HTMLSpanElement> {
  /** Step number/label rendered inside the badge (Figma's single TEXT child, e.g. "1"). */
  children: ReactNode;
}

/**
 * Molecule/Step — presentational step badge (Server Component, no "use client").
 *
 * Figma models this as a single fixed component (no variant/state axis on the
 * dev-ready node) — a 32x32 circular badge, centered content. Lives under
 * `components/molecules/` per `design/figma-map.json` (ADR-0010 map is
 * canonical), even though Figma files it in the "Atoms"/"Steps" section.
 */
export function Step({ children, className, ...props }: StepProps) {
  return (
    <span
      {...props}
      className={clsx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-semibold text-text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
