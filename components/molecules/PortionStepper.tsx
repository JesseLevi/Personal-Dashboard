// figma: node-id=3953:9750 (mobile) / 3778:5596 (desktop, pixel-identical) —
// restyled per the Pas-aan panel's own Personen row, node-id=3999:11007
// (desktop) / 3998:10928 (mobile), which models this control as ONE filled
// Button pill.
import { cn } from "@/lib/ui/cn";
import { Button } from "../atoms/Button";

/**
 * Molecule/Portion-stepper — Figma (3999:11007) draws Personen as a single
 * `Button/Default` (Style=Filled) instance: leading icon, text, trailing
 * icon, `h-10`/`gap-1`/`px-2`/`rounded-lg`/`bg-surface-secondary` — exactly
 * `Atom/Button`'s own classes. A real `<button>` can't nest two more
 * `<button>`s, and decrement/increment need separate click targets, so this
 * renders two plain icon-only `Button`s (their own Filled hover/active ramp)
 * inside a same-styled pill wrapper — reads as one control, is structurally
 * two. Left renders `Minus` though Figma draws `Icon/Plus` on both sides
 * (deliberate deviation, recurs here). `min` (#153) clamps/disables the
 * decrement floor. Full history: design/notes/PortionStepper.md.
 */
export interface PortionStepperProps {
  /** Current portion count (Figma TEXT "6") — caller-owned state. */
  portions: number;
  /** Pre-translated display text for the count, e.g. "6 personen"/"6 people" (ICU-pluralised — see `messages/*.json` `components.portionStepper.count`). */
  label: string;
  /** Accessible name for the left (decrement) button. */
  decrementLabel: string;
  /** Accessible name for the right (increment) button. */
  incrementLabel: string;
  /** Fires with the target portion count on either press. See design/notes/PortionStepper.md for why this is a single onChange rather than onIncrement/onDecrement. */
  onChange?: (next: number) => void;
  /** Floor for the decrement button — clamped and disabled at this value. Default `1` (#153, user-ruled: personen can never go to 0 or negative). */
  min?: number;
  className?: string;
}

export function PortionStepper({
  portions,
  label,
  decrementLabel,
  incrementLabel,
  onChange,
  min = 1,
  className,
}: PortionStepperProps) {
  const atMin = portions <= min;
  return (
    <div
      className={cn(
        // spacing-flag: `gap-1` — Button's own root gap-1 is unbound in
        // Figma (Alignment=Center); this component declares Filled-style
        // equivalence, not an independent measurement. design/notes/PortionStepper.md.
        "inline-flex h-10 items-center gap-1 rounded-control bg-surface-secondary",
        className,
      )}
    >
      <Button
        icon="Minus"
        aria-label={decrementLabel}
        onClick={() => onChange?.(Math.max(min, portions - 1))}
        disabled={atMin}
      />
      <span className="text-base font-semibold text-text-secondary">{label}</span>
      <Button
        icon="Plus"
        aria-label={incrementLabel}
        onClick={() => onChange?.(portions + 1)}
      />
    </div>
  );
}
