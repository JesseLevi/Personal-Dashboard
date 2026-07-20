// figma: node-id=3727:4084
import clsx from "clsx";
import type { HTMLAttributes } from "react";
import { Icon } from "./Icon";

export interface CheckboxProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Checked=Yes/No variant axis from the Figma component set. */
  checked: boolean;
}

/**
 * Atom/Checkbox — presentational only (Server Component, no "use client").
 *
 * This atom renders the visual state (Checked=No/Yes) driven by the `checked`
 * prop. It intentionally does not own any interaction: no onClick/onChange,
 * no tabIndex, no form wiring. A composing molecule/organism owns the
 * interactive control (native <input type="checkbox"> or a client wrapper)
 * and forwards its state in here — see the accessibility note in the PR.
 */
export function Checkbox({ checked, className, ...props }: CheckboxProps) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface",
        className,
      )}
      {...props}
    >
      {checked && <Icon name="Check" size={20} className="text-accent" />}
    </div>
  );
}
