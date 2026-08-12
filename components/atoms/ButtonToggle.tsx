"use client";

// figma: node-id=3623:4345
import clsx from "clsx";
import { useState, type KeyboardEvent } from "react";
import { Button } from "./Button";
import type { IconName } from "./Icon";

/**
 * Atom/Button-toggle — Figma `Button/Toggle` (node-id 3623:4345). Full
 * history: `design/notes/ButtonToggle.md`.
 *
 * The Figma node is the whole track, not one segment: a `role="radiogroup"`
 * composing real `Button` instances (`size="compact"`) with one shared
 * indicator sliding between them. Uses the WAI-ARIA Radio Group pattern
 * (aria-checked, roving tabindex, arrow-key nav), not `aria-pressed` — this
 * control is "exactly one of N", not an independent toggle.
 */
export interface ButtonToggleItem {
  /** Stable identifier for this segment, returned by `onValueChange`. */
  value: string;
  /** Figma "With icon" — every fetched segment is icon-only. */
  icon: IconName;
  /** Accessible name for this segment (icon-only, so always required). */
  label: string;
}

type ButtonToggleBaseProps = {
  /** Ordered segments. Figma exposes no icon-swap property at the track level (only Text/With text/With icon on the nested `Atom/Button`) — the fetched 5-icon set is a fixed demo, not a component property, so the real list is caller-supplied. */
  items: readonly ButtonToggleItem[];
  /** Initially-selected segment's `value`. Required: the fetched node never shows an unselected track. */
  defaultValue: string;
  /** Fires whenever the selection changes (click or arrow-key navigation). */
  onValueChange?: (value: string) => void;
  className?: string;
};

/** The radiogroup needs an accessible name; same required-one-of idiom as this codebase's other labelled atoms. */
export type ButtonToggleProps =
  | (ButtonToggleBaseProps & {
      "aria-label": string;
      "aria-labelledby"?: never;
    })
  | (ButtonToggleBaseProps & {
      "aria-label"?: never;
      "aria-labelledby": string;
    });

// 36px/step = 32px segment (`size-8`) + 4px gap. Static table because
// Tailwind needs literal class names (no inline `style`); capped at 8 —
// extend before a design needs more segments, see design/notes/ButtonToggle.md.
const INDICATOR_OFFSETS = [
  "translate-x-[0px]",
  "translate-x-[36px]",
  "translate-x-[72px]",
  "translate-x-[108px]",
  "translate-x-[144px]",
  "translate-x-[180px]",
  "translate-x-[216px]",
  "translate-x-[252px]",
] as const;

export function ButtonToggle({
  items,
  defaultValue,
  onValueChange,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: ButtonToggleProps) {
  const [value, setValue] = useState(defaultValue);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const offsetIndex = Math.min(selectedIndex, INDICATOR_OFFSETS.length - 1);

  function select(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % items.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(items[nextIndex].value);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const radios = group?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    radios?.[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      // w-fit + self-start: without both, a stretch-cross-axis parent (e.g. flex-col) silently stretches this track full-width.
      className={clsx(
        "relative inline-flex w-fit items-stretch gap-inline-xs self-start rounded-control bg-surface-secondary p-component-xs",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute left-component-xs top-component-xs size-8 rounded-control-inner bg-surface-highlight-white transition-transform duration-200 ease-out motion-reduce:transition-none",
          INDICATOR_OFFSETS[offsetIndex],
        )}
      />
      {items.map((item, index) => (
        // `relative` stacks this segment above the absolutely-positioned indicator — required for correct paint order.
        // Which is also why the segment must stay fill-less in every state: any
        // background here paints OVER the white indicator. Figma pins these to
        // `Atom/Button/Icon/Default/No` with `fills: []` and gives Button/Toggle
        // no state axis at all, so Transparent's Hover/Active fills (#107) don't
        // apply to segments — suppressed with `!` because a plain
        // `hover:bg-transparent` ties on specificity with the variant's own
        // utility. See design/notes/ButtonToggle.md.
        <Button
          key={item.value}
          type="button"
          variant="transparent"
          size="compact"
          icon={item.icon}
          aria-label={item.label}
          role="radio"
          aria-checked={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => select(item.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className="relative hover:bg-transparent! active:bg-transparent!"
        />
      ))}
    </div>
  );
}
