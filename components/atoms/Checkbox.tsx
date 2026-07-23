// figma: node-id=3727:4084
import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

/**
 * Atom/Checkbox — Figma "Checkbox" (node-id 3727:4084). Checked=No/Yes →
 * `checked` prop. Full history: `design/notes/Checkbox.md`.
 *
 * Host is a native `<button role="checkbox">`, not a `<div>` — free
 * focusability + Space/Enter activation; `checked` stays composer-owned.
 * Icon colour is `text-muted`, not `accent` (the purple in the fetched
 * component-SET node is a Figma canvas artifact, not a design property).
 *
 * Flagged gap: fetched node has no "delete" state.
 */
export interface CheckboxProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Checked=No/Yes variant axis from the Figma component set. */
  checked: boolean;
}

export function Checkbox({
  checked,
  className,
  type = "button",
  ...props
}: CheckboxProps) {
  return (
    <button
      type={type}
      role="checkbox"
      aria-checked={checked}
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface",
        className,
      )}
      {...props}
    >
      {checked && <Icon name="Check" size={20} className="text-text-muted" />}
    </button>
  );
}
