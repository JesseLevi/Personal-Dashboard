// figma: node-id=3727:4084
import { cn } from "@/lib/ui/cn";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

/**
 * Atom/Checkbox — Figma "Checkbox" (node-id 3727:4084). Checked=No/Yes →
 * `checked` prop. Full history: `design/notes/Checkbox.md`.
 *
 * Host is a native `<button role="checkbox">`, not a `<div>` — free
 * focusability + Space/Enter activation; `checked` stays composer-owned.
 * Icon colour is `text-text-secondary`, not the retired `accent` token (the
 * purple in the fetched component-SET node was a Figma canvas artifact, not
 * a design property — see #203).
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
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-stroke-primary bg-surface-highlight-white",
        className,
      )}
      {...props}
    >
      {checked && <Icon name="Check" size={20} className="text-text-secondary" />}
    </button>
  );
}
