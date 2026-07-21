// figma: node-id=3727:3208
import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export interface StepProps extends HTMLAttributes<HTMLSpanElement> {
  /** Step number/label rendered inside the badge (Figma's single TEXT child, e.g. "1"). */
  children: ReactNode;
}

/**
 * Atom/Step — presentational step badge (Server Component, no "use client").
 *
 * Figma models this as a single fixed component (no variant/state axis on the
 * dev-ready node) — a 32x32 circular badge, centered content. Filed under
 * Figma's "Atoms"/"Steps" section; moved here from `components/molecules/`
 * 2026-07-21 to match (see `design/figma-map.json`). `Card` composes it as a
 * nested instance (molecule importing atom — CLAUDE.md's allowed direction).
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
