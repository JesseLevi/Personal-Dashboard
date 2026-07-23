// figma: node-id=3624:4448
import clsx from "clsx";
import type { ReactNode } from "react";
import { Step } from "../atoms/Step";

/**
 * Molecule/Card — Figma component "Card" (node-id 3624:4448, Molecules section).
 * `Title` bool + `Text` -> `title?: string`; `Step` bool -> `step?: ReactNode`
 * (composed via the `Step` atom); SLOT "Type" -> required `children`.
 * No variant/state axis on this node; `clsx` merges className.
 * — see design/notes/Card.md for structure, token, and story history.
 */
export interface CardProps {
  /** Figma `Title` bool + `Text` — heading rendered above the content row. Omit to hide. */
  title?: string;
  /** Figma `Step` bool — step badge rendered via the `Step` atom. Omit to hide. */
  step?: ReactNode;
  /** Figma SLOT "Type" — the card's content, typically a `Card-content/*` molecule. */
  children: ReactNode;
  className?: string;
}

export function Card({ title, step, children, className }: CardProps) {
  return (
    <div className={clsx("flex w-full flex-col gap-3", className)}>
      {title ? (
        <p className="text-base font-semibold text-text">{title}</p>
      ) : null}
      <div className="flex w-full items-center gap-3">
        {step ? <Step>{step}</Step> : null}
        <div className="flex w-full flex-col justify-center rounded-xl border border-border bg-surface p-2">
          {children}
        </div>
      </div>
    </div>
  );
}
