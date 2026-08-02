// figma: node-id=3953:9750 (mobile) / 3778:5596 (desktop, pixel-identical)
import clsx from "clsx";
import { Button } from "../atoms/Button";

/**
 * Molecule/Portion-stepper — two icon-only `Atom/Button` instances (Style=Filled,
 * measured 40x40, `bg-surface-raised`/`rounded-lg`) flanking a `text-xl/semibold`
 * portion count. Figma draws `Icon/Plus` on BOTH sides; the left button renders
 * `Minus` instead — a deliberate deviation, not a guess. Full measurements,
 * ticket history and the deviation record: `design/notes/PortionStepper.md`.
 * Presentational only (Server Component) — `label`/`decrementLabel`/
 * `incrementLabel` arrive pre-translated, same idiom as
 * `CardContentIngredient`'s `deleteLabel`. `min` (#153) clamps the decrement
 * target and disables the decrement Button at the floor — see
 * design/notes/PortionStepper.md for why this lives here, not in the caller.
 */
export interface PortionStepperProps {
  /** Current portion count (Figma TEXT "6 personen") — caller-owned state. */
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
    <div className={clsx("inline-flex items-center gap-6", className)}>
      <Button
        icon="Minus"
        aria-label={decrementLabel}
        onClick={() => onChange?.(Math.max(min, portions - 1))}
        disabled={atMin}
      />
      <span className="text-xl font-semibold text-text">{label}</span>
      <Button
        icon="Plus"
        aria-label={incrementLabel}
        onClick={() => onChange?.(portions + 1)}
      />
    </div>
  );
}
