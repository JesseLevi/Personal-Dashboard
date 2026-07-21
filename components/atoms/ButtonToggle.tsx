"use client";

// figma: node-id=3623:4345
import clsx from "clsx";
import { useState, type KeyboardEvent } from "react";
import { Button } from "./Button";
import type { IconName } from "./Icon";

/**
 * Atom/Button-toggle — Figma component `Button/Toggle` (node-id 3623:4345).
 * Re-fetched for ticket #60 (also re-fetched `Atom/Button`, node-id 3623:4346,
 * since the segments are `Atom/Button` instances).
 *
 * ## Component-boundary correction (ticket #60)
 *
 * Ticket #35 built this file as a single segment (root track + one capsule),
 * flagging the grouped composition as out of scope. The re-fetch confirms
 * the ticket's premise: `Button/Toggle` (3623:4345) is not one segment, it
 * **is the whole track** — a single root frame (row, 4px padding, 4px gap,
 * fill stone-200 -> `surface-raised`, radius 8) containing:
 * - one "Active" rectangle (32x32, fill white -> `surface`, radius 6, inset
 *   4px from the top-left) — the moving indicator, listed (and therefore
 *   painted) *before* the buttons, i.e. behind them;
 * - five "Atom/Button" instances (Infinity/Croissant/Sandwich/Broccoli/
 *   Cake-slice), each a fixed 32-wide, transparent (`fills: []`), icon-only
 *   segment.
 *
 * Per CLAUDE.md ("mirror Figma's own nesting"), this file is now the track:
 * a `role="radiogroup"` composing real `Button` instances as segments, not a
 * one-segment atom callers were expected to array themselves (the approach
 * the old `CategoryFilterRow` story approximated, and which could never
 * produce one indicator sliding between icons — it only ever animated
 * independent per-segment capsules).
 *
 * ## Segment size (ticket #69: made structural, not emergent)
 *
 * The fetched node resizes its nested `Atom/Button` instances to 32x32 (an
 * instance override — Button's own component set has no Size property). That
 * footprint cannot be reproduced from here with a `className`: `h-8` and
 * `h-10` are the same property at the same specificity, so the winner is
 * decided by Tailwind's utility ordering, not by the caller. So `Button`
 * gained a `size="compact"` variant.
 *
 * Ticket #60 first landed `compact` as `h-8 pl-1 pr-0`, which only *totals*
 * to a 32px width (4px inset + 24px icon + 4px icon-trailing-padding) rather
 * than stating 32 directly — any future change to the icon's default size or
 * the icon wrapper's padding would silently de-square it without touching
 * this file at all. Ticket #69 measured the actual rendered markup (no
 * headless browser here — rendered both `Button` and `ButtonToggle` via
 * `react-dom/server`'s `renderToStaticMarkup` and read the resolved class
 * list + the icon `<svg>`'s literal `width`/`height` attributes) and
 * confirmed the arithmetic *did* land on 32x32 today, but only by three
 * independent numbers summing correctly. `compact` is now `size-8
 * justify-center` — one Tailwind utility asserting width equal to height,
 * with the icon centred by flex alignment instead of by padding math — so
 * the square is guaranteed by the classes themselves. See `Button.tsx`'s own
 * size-variant doc for the full before/after.
 *
 * Track height and hug width are unchanged by this: 4px padding + 32px
 * segment + 4px padding = 40px tall; five 32px segments + four 4px gaps +
 * 8px total padding = 184px wide for the five-segment demo — both re-verified
 * against the fetched node's own numbers (root: 4px padding, 4px gap; "Active"
 * rectangle: 32x32).
 *
 * ## Track must always hug (ticket #69)
 *
 * The fetched node is `hug` on both axes — it should only ever be as wide as
 * its segments. `inline-flex` already hugs on its own, but that default is
 * not the same as *asserting* hug: this root is a flex item wherever a
 * caller places it, and a parent that sets `align-items: stretch` on its own
 * cross axis (e.g. a plain `flex flex-col` wrapper — column layouts default
 * to `stretch`) will stretch this div's width to fill the parent regardless
 * of `inline-flex`, because stretch overrides an auto cross-size before the
 * child's own display type is consulted. `self-start` (opts this item out of
 * a flex/grid parent's stretch) and `w-fit` (states the hug width directly,
 * covering contexts like CSS Grid's `justify-items: stretch`) together make
 * the hug a property of this component, not of how a caller happens to lay
 * out its container — a caller cannot accidentally stretch this track.
 *
 * ## Movement
 *
 * The indicator is one absolutely-positioned `span` (32x32, matching the
 * segment footprint; inset by the track's own 4px padding via `top-1
 * left-1`), translated on the x-axis by `index * (segment width + gap)` =
 * `index * 36px`. Segments are given `relative` (and the indicator
 * left un-z-indexed) so normal DOM/paint order — indicator first, segments
 * after — puts the segments visually on top, reproducing the fetched node's
 * own layer order; a plain `absolute` indicator among `static` siblings would
 * otherwise always paint on top regardless of source order, since positioned
 * elements stack above the normal flow irrespective of DOM order.
 *
 * The fetched node is a single static frame — it shows no transition/timing
 * property at all (Figma has no way to encode one). The *fact* that the
 * indicator should move is the ticket's own explicit, deliberate
 * requirement, not a code-side invention; the concrete duration/easing is
 * not Figma-sourced and reuses Tailwind's stock scale, the same honestly-
 * flagged non-Figma choice `Dropdown`'s open/close animation already made
 * (see its doc comment) — no project motion token exists yet either.
 * `motion-reduce:transition-none` follows the same precedent.
 *
 * Because Tailwind needs a literal class string per possible offset (no
 * inline `style`, per this ticket and CLAUDE.md), `INDICATOR_OFFSETS` is a
 * static, capped lookup table rather than a computed value. The cap (8
 * entries) is a pragmatic implementation bound tied to that constraint, not
 * a Figma limit — the fetched demo only needs 5. An `items` list longer than
 * the table clamps to the last defined offset; extend the table before a
 * design ever needs more than 8 segments.
 *
 * ## Segment footprint re-verified, unchanged (ticket #80)
 *
 * The 32x32/36px-step numbers above had already flip-flopped once (#60
 * shipped 40x40, corrected to 32x32 in the same ticket's review), so this
 * ticket re-fetched 3623:4345 fresh rather than trusting the recorded
 * history: root row, 4px padding, 4px gap, hug/hug sizing with a
 * `designedHeight` of 40px; the "Active" rectangle is `{width: 32, height:
 * 32}` at `{x: 4, y: 4}`; each nested `Atom/Button` instance is fixed-width
 * 32 with `sizing.vertical: fill` (i.e. it fills the 32px content height
 * left after the track's own 4px+4px padding). All three numbers match this
 * file's existing `size-8` segments/`size-8` indicator/`gap-1` track
 * unchanged — confirmed pixel-for-pixel in a real browser too (Playwright
 * against `pnpm ladle`, `getBoundingClientRect` on the rendered
 * `CategoryFilter` story): track 184x40, indicator 32x32 at (4, 4), all five
 * segments 32x32 with their 24x24 icons centred. A downloaded render of the
 * fetched node (`download_figma_images`, 368x80 at 2x scale = 184x40 at 1x)
 * is visually identical to the rendered story. The user's "40x40" reading
 * was very likely the track's own 40px height (the fetched node's
 * `designedHeight`) being attributed to the segments/indicator it contains,
 * not a discrepancy in this file — no code change was needed here for that
 * defect.
 *
 * ## Colour
 *
 * No per-segment colour/state variation is present in the fetched node —
 * the same finding ticket #35 already recorded for this exact node: the
 * icon behind the white capsule renders in the same muted stroke as the
 * others. So no `aria-checked:text-*` override is added; icon colour stays
 * `text-text-muted` (via `Button`'s own `transparent` variant) regardless of
 * selection, matching the node exactly rather than inventing a selected-icon
 * colour.
 *
 * ## Accessibility pattern
 *
 * `Button.tsx`'s own "Selected" state, and the old single-segment version of
 * this file, both use `aria-pressed` — the right idiom for an independent
 * toggle button. This control is different: exactly one segment is ever
 * selected, the same "exactly one of N" shape as a native radio group. WAI-
 * ARIA's Radio Group pattern (https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
 * is built for precisely this — `role="radiogroup"` + `role="radio"` /
 * `aria-checked`, roving `tabindex` (only the selected segment is in the tab
 * order), and Left/Right (Up/Down as an alias) + Home/End arrow-key
 * selection — where `aria-pressed`'s contract has no such group/roving-focus
 * model. The pattern is layered onto unmodified `Button` instances purely
 * via props it already spreads onto its native `<button>`
 * (`role`/`aria-checked`/`tabIndex`/`onClick`/`onKeyDown` are all standard
 * `ButtonHTMLAttributes`/`AriaAttributes`) — zero changes to `Button.tsx`.
 * Click/Space/Enter activate a segment for free (native `<button>`).
 *
 * `Button.tsx` isn't `forwardRef`, so roving focus after an arrow key can't
 * use a component ref; `handleKeyDown` instead walks the DOM from the
 * keyboard event's own `currentTarget` (`closest('[role="radiogroup"]')` +
 * `querySelectorAll('[role="radio"]')`) to focus the next segment — a
 * standard technique for roving tabindex when the underlying control isn't
 * ref-forwarding.
 *
 * ## "use client" and state
 *
 * Which segment is selected is the group's own behaviour, identical for
 * every caller — the same reasoning `Dropdown` (#43) used for owning its
 * open/closed state internally, contrasted with `Checkbox` (#45), whose
 * `checked` stays composer-owned because it varies meaningfully per call
 * site. This group always starts with exactly one segment active (the
 * fetched node never samples an "all unselected" state), so `defaultValue`
 * is required, not optional.
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

// Segment footprint (32px, `size-8` — Button's `size="compact"`, structurally
// square per ticket #69, not derived from padding) + 4px track gap (`gap-1`)
// = 36px per step. The indicator span below is sized with that same `size-8`
// utility, so segment size and indicator size can never drift apart — a
// future change to either number must change both, and the offset table here
// alongside it. Tailwind needs literal class names (no inline `style`), so
// the offsets are a static table; capped at 8 segments — see the "Movement"
// doc above.
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
      className={clsx(
        "relative inline-flex w-fit items-stretch gap-1 self-start rounded-lg bg-surface-raised p-1",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "pointer-events-none absolute left-1 top-1 size-8 rounded-md bg-surface transition-transform duration-200 ease-out motion-reduce:transition-none",
          INDICATOR_OFFSETS[offsetIndex],
        )}
      />
      {items.map((item, index) => (
        // `relative` only: stacks this segment above the absolutely-
        // positioned indicator (see the "Movement" doc above). `shrink-0`
        // used to be set here too, but ticket #80 moved it onto `Button`
        // itself (every size/variant, base class) once the same missing
        // defence was found squashing two other call sites
        // (CardContentIngredient's Checkbox/Trash Button) — this was the
        // one call site that had already worked around the bug locally, so
        // keeping a local copy here would be redundant now that the atom
        // defends its own footprint.
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
          className="relative"
        />
      ))}
    </div>
  );
}
