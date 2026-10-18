"use client";

// figma: node-id=4160:33335
import { cn } from "@/lib/ui/cn";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Molecule/Button-toggle — Figma `Button/Toggle` (node-id 4160:33335,
 * Development > Molecules > Toggles). Built from scratch for #265 — the old
 * `Atom/ButtonToggle` (node 3623:4345, now orphaned in Figma) is retired,
 * see `design/notes/ButtonToggle.md` for the full history carried over.
 *
 * Structure mirrors Figma exactly: optional `Titel` text + a `Container`
 * holding an `ActiveBackground` and a SLOT of nested `Button` instances.
 * Unlike the old atom's fixed-width icon-only segments, these are
 * text-labelled and therefore variable-width, so the indicator's position
 * AND size are measured at runtime (ref + ResizeObserver) rather than a
 * static offset table — see `design/notes/ButtonToggle.md`.
 */
export interface ButtonToggleItem {
  /** Stable identifier for this segment, returned by `onValueChange`. */
  value: string;
  icon: IconName;
  /** Segment label — also the accessible name (WAI-ARIA radio pattern). */
  label: string;
}

type ButtonToggleBaseProps = {
  items: readonly ButtonToggleItem[];
  /** Initially-selected segment's `value`. Required: the fetched node never shows an unselected track. */
  defaultValue: string;
  onValueChange?: (value: string) => void;
  /** Below `md` only the icons show; the label stays as the accessible name. */
  iconOnlyBelowMd?: boolean;
  /** Same, below `lg`. */
  iconOnlyBelowLg?: boolean;
  className?: string;
};

/**
 * Figma boolean `Titel#4160:0` (default on). When given, `title` also
 * supplies the radiogroup's accessible name via `aria-labelledby` — no
 * separate `aria-label` needed or allowed, same required-one-of idiom as
 * `Dropdown`'s `label`/`id` pair.
 */
export type ButtonToggleProps =
  | (ButtonToggleBaseProps & { title: string; "aria-label"?: never })
  | (ButtonToggleBaseProps & { title?: never; "aria-label": string });

export function ButtonToggle({
  items,
  defaultValue,
  onValueChange,
  iconOnlyBelowMd,
  iconOnlyBelowLg,
  title,
  className,
  "aria-label": ariaLabel,
}: ButtonToggleProps) {
  const [value, setValue] = useState(defaultValue);
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Positions/sizes the indicator off the DOM, not a static offset table —
  // segments carry text labels of unequal width (Systeem/Licht/Donker), so a
  // fixed step size (the old atom's approach, icon-only/uniform-width
  // segments) cannot work here. `role="radio"` buttons share the same
  // padding-edge coordinate origin as the indicator (both are direct
  // children of the same `relative`-positioned, `p-component-xs` row), so a
  // radio's own `offsetLeft/Top/Width/Height` — relative to that row, its
  // nearest positioned ancestor — is exactly the indicator's target
  // transform/size, with no extra padding arithmetic needed.
  function positionIndicator() {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;
    const radios = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const index = items.findIndex((item) => item.value === value);
    const active = radios[index < 0 ? 0 : index];
    if (!active) return;
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
  }

  // Layout effect (not a plain effect): computes the indicator's first
  // position before the browser paints, so there is no flash at (0,0)/0x0
  // before the first real measurement lands.
  useLayoutEffect(() => {
    positionIndicator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  // Re-measures on any reflow the value/items effect above wouldn't catch —
  // a font finishing loading, the row itself resizing under a responsive
  // parent. ResizeObserver over the row (not individual segments): any
  // segment's width change necessarily changes the row's own content box
  // too, since segments are its only children.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => positionIndicator());
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
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
    const radios = event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[nextIndex]?.focus();
  }

  return (
    <div className={cn("flex w-full flex-col gap-stack-sm", className)}>
      {title ? (
        <span id={titleId} className="text-base font-semibold text-text-secondary">
          {title}
        </span>
      ) : null}
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        // Full width, not hug: Figma's `Container` is `hSize: FILL` (the
        // retired atom's `w-fit self-start` was hug-width reasoning that
        // doesn't apply here). See design/notes/ButtonToggle.md.
        className="relative flex w-full items-stretch gap-inline-xs rounded-card bg-surface-highlight-white p-component-xs"
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          // Figma's ActiveBackground fill is a flat neutral grey that binds
          // no variable and matches no Tailwind stone step — it reads as
          // Figma's own default new-shape fill (an authoring artifact, not a
          // deliberate value). `surface-secondary` (stone-200) is the
          // nearest existing "static neutral surface" role token — flagged,
          // not invented. See design/notes/ButtonToggle.md.
          className="pointer-events-none absolute top-0 left-0 rounded-control bg-surface-secondary transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none"
        />
        {items.map((item, index) => (
          // `relative` stacks each segment above the indicator; fill-less in
          // every state so no segment background paints over it. `grow
          // basis-0` (not `flex-1`) splits the track evenly without
          // contesting Button.tsx's own `shrink-0` (#80) — longhand
          // utilities, no emission-order race. See design/notes/ButtonToggle.md.
          <Button
            key={item.value}
            type="button"
            variant="transparent"
            icon={item.icon}
            role="radio"
            aria-checked={item.value === value}
            tabIndex={item.value === value ? 0 : -1}
            onClick={() => select(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="relative grow basis-0 hover:bg-transparent! active:bg-transparent!"
          >
            {iconOnlyBelowLg ? (
              <span className="max-lg:sr-only">{item.label}</span>
            ) : iconOnlyBelowMd ? (
              <span className="max-md:sr-only">{item.label}</span>
            ) : (
              item.label
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
