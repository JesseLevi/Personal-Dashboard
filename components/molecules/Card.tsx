// figma: node-id=3624:4448
import clsx from "clsx";
import type { ReactNode } from "react";
import { Step } from "../atoms/Step";

/**
 * Molecule/Card — Figma component set "Card" (node-id 3997:25430, V2/#160;
 * `3624:4448`'s original single-component node is now its "Title=No"
 * variant within this set). `Title` bool + `Text` -> `title?: string`;
 * `Settings` bool (new, #160) -> `settings?: ReactNode` — always paired
 * with `Title` in the fetched nodes, but rendered whenever either is given
 * so an untitled group card can still carry the trigger (see
 * design/notes/Card.md); `Step` bool -> `step?: ReactNode` (composed via the
 * `Step` atom); SLOT "Type" -> required `children`. No state axis on this
 * node; `clsx` merges className. — see design/notes/Card.md for structure,
 * token, and story history.
 */
export interface CardProps {
  /** Figma `Title` bool + `Text` — heading rendered above the content row. Omit to hide the text (the row itself still renders if `settings` is given). */
  title?: string;
  /** Figma `Settings` bool (#160) — trigger (e.g. the Pas-aan gear button) rendered right-aligned in the title row. Omit to hide. */
  settings?: ReactNode;
  /** Figma `Step` bool — step badge rendered via the `Step` atom. Omit to hide. */
  step?: ReactNode;
  /** Figma SLOT "Type" — the card's content, typically a `Card-content/*` molecule. */
  children: ReactNode;
  className?: string;
}

export function Card({ title, settings, step, children, className }: CardProps) {
  return (
    <div className={clsx("flex w-full flex-col gap-3", className)}>
      {title || settings ? (
        <div className="flex w-full items-end justify-between gap-3">
          {title ? (
            <p className="text-base font-semibold text-text">{title}</p>
          ) : (
            <span aria-hidden="true" />
          )}
          {settings}
        </div>
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
