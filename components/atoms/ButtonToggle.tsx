// figma: node-id=3623:4345
import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Button-toggle — Figma component `Button/Toggle` (node-id 3623:4345).
 *
 * Figma properties: `Text` (text, default "Categorie "), `With text` (bool,
 * default true), `With icon` (bool, default true). No `State`/`Active`
 * variant axis exists on this component — the fetched node shows the
 * pressed/selected look purely as an extra layer (a white, rounded-md
 * rectangle inset 4px, positioned absolutely behind one button instance in
 * the demo), not a component property. Per CLAUDE.md/ticket #35 this is
 * implemented as `aria-pressed` + a CSS pseudo-class (`group-aria-pressed:`),
 * never a React prop — a real toggle button pattern (native `<button>` +
 * `aria-pressed`), not a variant.
 *
 * Structure mirrors the fetched node's two layers, unlike Button.tsx's flat
 * single-element states:
 * - Outer `<button>`: the root frame (fills the stone-200 primitive ->
 *   `surface-raised`, rounded-lg, 4px padding on every side, 40px tall) —
 *   always present, regardless of pressed state.
 * - Inner `<span>`: the "Active" highlight capsule (32x32, rounded-md, fills
 *   white -> `surface`) — transparent by default, filled only when
 *   `aria-pressed="true"` via `group-aria-pressed:bg-surface` on the parent
 *   button. Icon/text sit inside this inner layer.
 *
 * Icon/text color does not change between pressed and unpressed in the
 * fetched node (every sampled icon, including the one behind the white
 * highlight, renders in the same muted stroke) — so unlike Button.tsx's
 * Filled variant (whose Selected state, renamed from "Active" in Figma
 * 2026-07-20 per ticket #42, darkens the text), no text-color pseudo-class
 * is added here; only the background changes.
 *
 * `With icon` / `With text` -> optional props, same idiom as Button.tsx:
 * presence of `icon` is the icon boolean. `children` presence is the text
 * boolean; omitting it requires `aria-label` (see `ButtonToggleProps`) so an
 * icon-only toggle still has an accessible name. Figma's `Text` property
 * carries a default string value ("Categorie "), but — matching Button.tsx's
 * own precedent of never baking demo copy into the component — that default
 * is NOT hardcoded here: `children` is always caller-supplied. Baking a
 * translated fallback into the atom itself would also need a server-only
 * i18n call (`next-intl/server`), which would break the component the
 * moment a composing Client Component (the expected home for the
 * onClick/aria-pressed wiring per CLAUDE.md's "interactivity is wired by the
 * composing molecule" rule) imports it directly. The Figma default is
 * instead reproduced in the Ladle story via the message catalog
 * (`messages/en.json` / `messages/nl.json` -> `buttonToggle.defaultLabel`),
 * never as a literal string in source.
 *
 * Figma exposes no icon-swap property on `Button/Toggle` itself (only
 * Text/With text/With icon) — the demo's 5 different icons are separate
 * nested instance overrides, not a component property. `icon` is still
 * exposed as a normal optional prop (mirrors Button.tsx's `icon`) so the
 * atom is usable for more than the one hardcoded demo icon.
 *
 * Gaps flagged, not invented:
 * - No Hover state is sampled for `Button/Toggle` itself in the fetched
 *   node (unlike Button.tsx's own component set, which does sample Hover) —
 *   no hover class is added; triage before inventing one.
 * - The nested "Atom/Button" instance in the fetched node overrides padding
 *   to "0 12" inside a fixed 32px width, which doesn't reconcile with a
 *   24px icon (same kind of auto-layout drift Button.tsx already documents
 *   for its own Filled/Selected instance) — not followed. Spacing instead
 *   mirrors Button.tsx's own verified icon/text padding recipe (icon-only
 *   8px/8px, text-only 12px/12px, both 8px left/12px right) for consistency
 *   between the two sibling atoms.
 */
type ButtonToggleBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  /** Figma "With icon" boolean — pass an IconName to render the icon; omit to hide it. */
  icon?: IconName;
};

/**
 * Figma "With text" is expressed by the presence of `children` (same idiom
 * as Button.tsx). An icon-only toggle has no visible label, so TypeScript
 * requires an explicit `aria-label` in that case — otherwise the control
 * would be unnamed for assistive tech (CLAUDE.md: accessibility is part of
 * the atom).
 */
export type ButtonToggleProps =
  | (ButtonToggleBaseProps & { children: ReactNode })
  | (ButtonToggleBaseProps & { children?: never; "aria-label": string });

export function ButtonToggle({
  icon,
  children,
  className,
  type = "button",
  "aria-pressed": ariaPressed = false,
  ...props
}: ButtonToggleProps) {
  return (
    <button
      type={type}
      aria-pressed={ariaPressed}
      className={clsx(
        "group inline-flex h-10 items-center justify-center rounded-lg bg-surface-raised p-1 text-base font-semibold text-text-muted",
        className,
      )}
      {...props}
    >
      <span className="inline-flex h-8 items-center justify-center rounded-md pl-2 pr-1 transition-colors group-aria-pressed:bg-surface">
        {icon && (
          <span className="pr-1">
            <Icon name={icon} />
          </span>
        )}
        {children && <span className="pl-1 pr-2">{children}</span>}
      </span>
    </button>
  );
}
