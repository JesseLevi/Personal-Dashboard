// figma: node-id=3727:4084
import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

/**
 * Atom/Checkbox — Figma component set "Checkbox" (node-id 3727:4084).
 *
 * Fix history (#45, design review on #16):
 *
 * 1. Icon colour. The check glyph rendered purple because the original
 *    implementation applied `text-accent` (the `purple-figma` primitive) to
 *    it. Root cause: the fetched component-SET node (not the instance)
 *    reports a dashed purple `strokes` value at its root — that is Figma's
 *    own canvas artifact marking the selected component set boundary, not a
 *    design property of the checkbox. It happens to share its value with the
 *    `accent` semantic token, which made the mix-up an easy one to make from
 *    the raw MCP data without also sampling the actual rendered pixels.
 *    Re-fetching the "Checked=Yes" instance and sampling the exported
 *    `Icon/Check` PNG gives the real glyph colour: the `stone-500` primitive
 *    that already backs the `text-muted` semantic token (Figma calls this
 *    role `color/stroke/secondary`, but the sampled pixel value is an exact
 *    match for a token we already have). Per CLAUDE.md's
 *    token-gap rule, an exact-match existing token is reused rather than
 *    adding a new one for the same pixels — no `design/tokens.json` /
 *    `app/theme.css` edit was needed for this ticket. The Figma-side role
 *    name (`color/stroke/secondary`) not yet having its own semantic entry
 *    is the flagged gap, recorded in `design/notes/Checkbox.md`.
 *
 * 2. Interactivity. #16 shipped a purely presentational `<div role="checkbox">`
 *    with no click/keyboard handling. CLAUDE.md's default is that a leaf atom
 *    stays non-interactive and a composing Client Component wires the
 *    behaviour — but a `<div>` is not natively focusable and has no built-in
 *    keyboard activation, so that default would leave every composer having
 *    to reimplement Space-to-toggle by hand (easy to get wrong, easy to
 *    forget). This atom instead follows the exact precedent already set by
 *    `ButtonToggle.tsx` in this codebase: swap the host element from `<div>`
 *    to a native `<button type="button">` with `role="checkbox"` overriding
 *    its default semantics. A native button is focusable and treats both
 *    Space and Enter as activation for free, straight from the browser — so
 *    the atom gains real keyboard support without adding any handler logic
 *    of its own, stays a Server Component (no `"use client"`, no hooks), and
 *    the *state* still lives entirely with the composer: `checked` continues
 *    to drive `aria-checked` directly (never invented, never stale), and the
 *    composer supplies its own `onClick` (via the spread `ButtonHTMLAttributes`)
 *    to flip that state — same controlled idiom as `ButtonToggle`'s
 *    `aria-pressed`/`onClick` pair. A real `<input type="checkbox">` was
 *    considered and rejected: CLAUDE.md specifically warns against a
 *    misleading `readOnly` native input, and making one genuinely native
 *    would mean visually hiding it behind the custom 32px box for no
 *    accessibility gain over a `button[role=checkbox]`, which is a
 *    recognised custom-checkbox pattern (the same technique several
 *    production component libraries use).
 *
 * 3. Flex-shrink defence (ticket #80). Measured in a real browser
 *    (Playwright against `pnpm ladle`): inside `CardContentIngredient`'s
 *    width-constrained row, this atom's stated `h-8 w-8` (32x32) rendered
 *    as narrow as 27.5x32 — a flex item defaults to `flex-shrink: 1`, and
 *    nothing here opted out, so the browser was free to compress the width
 *    while `h-8` held the height fixed. Same failure class #69/#75 already
 *    named for padding-derived footprints, here via flex-shrink instead.
 *    `shrink-0` is added to this atom's own base classes (not left to each
 *    call site) because a fixed-square control has no layout where
 *    shrinking below its stated size is ever correct — this codebase
 *    already had exactly one call site (`ButtonToggle`'s segments) defend
 *    itself with a local `shrink-0` while two others (this component's own
 *    two call sites inside `CardContentIngredient`) did not, which was the
 *    actual bug: one layer of defence, applied inconsistently. See
 *    `Button.tsx`'s matching doc comment for the same reasoning applied to
 *    that atom's icon-only sizes.
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
