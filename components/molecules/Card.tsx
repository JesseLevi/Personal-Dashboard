// figma: node-id=3624:4448
import clsx from "clsx";
import type { ReactNode } from "react";
import { Step } from "./Step";

/**
 * Molecule/Card — Figma component "Card" (node-id 3624:4448, Molecules section).
 *
 * Figma structure, mirrored 1:1:
 *   root (column, gap-3, hug height, contextual width -> w-full)
 *   ├─ TEXT "Titel"          — `Title` bool (visible) + `Text` (text content)
 *   └─ "Stap + Card" (row, items-center, gap-3, fill width, hug height)
 *      ├─ INSTANCE "Step"    — `Step` bool (visible); reuses Molecule/Step as-is
 *      └─ SLOT "Type"        — always present; the card's content slot
 *
 * Figma property -> code:
 * - `Title` (bool) + `Text` (text) -> `title?: string`. Presence of the prop
 *   *is* the boolean (same pattern as Button's `icon` / InputField's `label`),
 *   so there's no way to pass `title=""` and still render an empty heading row.
 * - `Step` (bool) -> `step?: ReactNode`. When present it's rendered through the
 *   existing `Step` molecule (Figma nests an actual Step *instance* here, so
 *   the code imports and composes `Step` rather than re-implementing the badge).
 * - SLOT "Type" -> `children` (required — the slot is not gated by a Figma
 *   boolean, unlike Title/Step, so the card always needs content).
 *
 * No variant/state axis on this node (only booleans + text), so no CVA is used
 * — `clsx` merges the caller's `className` per house style, same as Step.
 *
 * Colours read from the fetched node, all matching existing semantic tokens
 * (no token gaps): heading fill (stone-950) -> `text-text`; slot fill (white)
 * -> `bg-surface`; slot stroke (stone-300) -> `border-border`.
 * `text-base/semibold` textStyle -> `text-base font-semibold` per the
 * typography map in design/tokens.json.
 *
 * Not modelled: the "Stap + Card" frame itself carries a 12px Figma corner
 * radius, but it has no fill/stroke of its own, so the radius has no visible
 * effect (nothing to clip) and is omitted rather than added as a no-op class.
 */
export interface CardProps {
  /** Figma `Title` bool + `Text` — heading rendered above the content row. Omit to hide. */
  title?: string;
  /** Figma `Step` bool — step badge rendered via the `Step` molecule. Omit to hide. */
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
