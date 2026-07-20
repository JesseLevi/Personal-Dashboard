// figma: node-id=3623:4346
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/Button — Figma component set "Button/Default" (node-id 3623:4346).
 *
 * Figma variant axes:
 * - Style: Filled | White | Transparent | Outline | Distructive (typo corrected
 *   to `destructive` in the code API, per ticket #13).
 * - State: Default | Hover | Selected — implemented as CSS pseudo-classes,
 *   never as a React prop. Selected was renamed from "Active" in Figma
 *   2026-07-20 (ticket #42): it's the persistent chosen state (e.g. a
 *   selected category chip), not "currently being pressed" — CSS `:active`
 *   means the latter, so it is the wrong hook and was never a correct
 *   implementation of this state. The code instead keys off `aria-pressed`
 *   (`aria-pressed:` Tailwind variant → `&[aria-pressed="true"]`), the same
 *   toggle-button idiom Atom/Button-Toggle already uses. This is a caller-
 *   supplied standard ARIA attribute (already part of `ButtonHTMLAttributes`
 *   via `AriaAttributes`), not a new prop — the composing molecule/organism
 *   sets `aria-pressed` when the button represents a persistent selection;
 *   `hover:` remains true CSS hover.
 * - Booleans `With icon` / `With text` — translated to optional props rather
 *   than literal flags: passing `icon` (an `IconName`) renders the leading
 *   icon, passing `children` renders the label. Presence of each prop *is*
 *   the boolean, so callers can't pass a mismatched `withIcon={true}` with no
 *   icon. Root/inner padding below mirrors Figma's nested Icon/Text frames
 *   exactly (root pl-2 pr-1, icon wrapper pr-1, text wrapper pl-1 pr-2) so
 *   icon-only, text-only, and icon+text combinations all reproduce the exact
 *   Figma spacing (icon-only: 8px/8px; text-only: 12px/12px; both: 8px
 *   left / 12px right) without needing a separate CVA prop per combination.
 *
 * Per-state fills/text, read from the fetched node and resolved to primitives
 * via design/tokens.json (exact Figma hex values live in design/figma-map.json,
 * never in component source — check-server-only.sh enforces that). Re-fetched
 * 2026-07-20 for ticket #52 (Figma reworked every colour role to carry a
 * per-state Default/Hover/Selected variation instead of Default + one ad-hoc
 * hover) — the state matrix below is what that re-fetch actually returned,
 * confirming the ticket's own table verbatim:
 * - Filled: bg stone-200 (surface-raised), text stone-500 (text-muted);
 *   hover bg stone-400 (surface-raised-hover — changed from stone-300 this
 *   ticket), text unchanged; selected bg stone-300 (surface-raised-selected —
 *   changed from "unchanged" this ticket), text stone-950 (text).
 * - White: bg white (surface), text text-muted; hover identical to default
 *   (Figma's Hover node resolves to the same fill/text as Default — no
 *   override needed); selected bg stone-50 (surface-selected — changed from
 *   "unchanged" this ticket), text -> text (stone-950).
 * - Transparent: no fill (bg-transparent), text-muted; hover identical to
 *   default; selected text -> text (no fill change, matches Figma).
 * - Outline: bg-transparent, 1px border-border (stone-300), text-muted;
 *   hover border -> stone-700 (border-hover-strong — changed from stone-500
 *   this ticket); selected border -> stone-400 (border-selected — changed
 *   from "reverts to border-border" this ticket), text -> text.
 * - Destructive ("Distructive" in Figma): bg red-50 (priority-urgent-bg),
 *   text red-400 (priority-urgent) for Default; hover bg -> red-200
 *   (priority-urgent-bg-hover) and selected bg -> red-100
 *   (priority-urgent-bg-selected) — both new this ticket, previously this
 *   style had no state-specific override at all; text stays priority-urgent
 *   in every state (Figma's Distructive text colour never changes).
 *
 * One fetched instance ("Style=Filled, State=Selected") shows uniform 8px/8px
 * root padding instead of the 4px/8px asymmetric padding every other sampled
 * variant uses — treated as Figma auto-layout drift on that single instance,
 * not a deliberate selected-only padding change, since Filled/Default and
 * Filled/Hover both use the standard padding.
 *
 * Content alignment (fixed for ticket #43): re-fetching this node's own
 * layout data shows every sampled Button/Default variant is a
 * `sizing.horizontal: hug` row with no `justifyContent` override — Figma's
 * default packed/MIN alignment (i.e. flex-start). The root class below used
 * to read `justify-center`, which is a no-op on a hug-sized standalone button
 * (there is no spare main-axis space to redistribute) but renders visibly
 * wrong, centred content the instant a caller stretches the button to fill a
 * wider row — exactly what `Atom/Dropdown`'s option-list slot does (the
 * fetched Dropdown node, 3705:4446, overrides its nested Button/Default
 * instances to `sizing.horizontal: fill` while still specifying no
 * `justifyContent`, i.e. still packed/left). The misalignment ticket #43
 * reported therefore lived here, in Button.tsx, not in Dropdown.tsx.
 * `justify-start` matches Figma's real default and is visually identical to
 * the old `justify-center` for every existing hug-sized story
 * (Button.stories.tsx) since hug sizing never has spare space to
 * redistribute in the first place.
 *
 * State colours read from dedicated per-role state tokens (ticket #52 —
 * see docs/design-tokens.md for the role/-hover/-selected convention every
 * future component should follow): `surface-raised-hover` /
 * `surface-raised-selected` (Filled), `surface-selected` (White),
 * `border-hover-strong` / `border-selected` (Outline), and
 * `priority-urgent-bg-hover` / `priority-urgent-bg-selected` (Destructive).
 * `surface-hover` and `border-hover` (the single ad-hoc hover pair #42 added)
 * are no longer read here: `surface-hover` lost its only consumer when
 * Filled's hover diverged from stone-300 to stone-400, and `border-hover`
 * stays reserved for `Atom/Input-field`'s Hover stroke (still stone-500),
 * which has now diverged in value from Outline's Hover stroke (stone-700) —
 * hence the separate `border-hover-strong` rather than changing
 * `border-hover` itself. Open question recorded in docs/design-tokens.md:
 * did one of the two Figma nodes simply not get re-bound to the shared
 * variable, or is the divergence intentional?
 *
 * Dark mode (ticket #42, extended #52): these are semantic-token classes
 * only (no `dark:` utility prefixes anywhere below) — light/dark is a
 * token-layer concern. Every token this component reads (`surface-raised`,
 * `surface-raised-hover`, `surface-raised-selected`, `surface-selected`,
 * `surface`, `border`, `border-hover-strong`, `border-selected`, `text`,
 * `text-muted`, `priority-urgent-bg`, `priority-urgent-bg-hover`,
 * `priority-urgent-bg-selected`) carries a dark override in
 * design/tokens.json, emitted by `pnpm sync:tokens` into a
 * `[data-theme="dark"]` block in app/theme.css. No Figma dark-mode frames
 * exist for this component, so the dark shades are this component's own
 * pick, kept inside Tailwind's stock stone/red scale (never a one-off hex).
 *
 * No "Disabled" state exists in the fetched component set, so none is
 * invented here (native `disabled` attribute still works via the `button`
 * element; add real Disabled styling once Figma defines it).
 */
const buttonVariants = cva(
  "inline-flex h-10 items-center justify-start rounded-lg pl-2 pr-1 text-base font-semibold transition-colors",
  {
    variants: {
      variant: {
        filled:
          "bg-surface-raised text-text-muted hover:bg-surface-raised-hover aria-pressed:bg-surface-raised-selected aria-pressed:text-text",
        outline:
          "border border-border bg-transparent text-text-muted hover:border-border-hover-strong aria-pressed:border-border-selected aria-pressed:text-text",
        white: "bg-surface text-text-muted aria-pressed:bg-surface-selected aria-pressed:text-text",
        transparent: "bg-transparent text-text-muted aria-pressed:text-text",
        destructive:
          "bg-priority-urgent-bg text-priority-urgent hover:bg-priority-urgent-bg-hover aria-pressed:bg-priority-urgent-bg-selected",
      },
    },
    defaultVariants: {
      variant: "filled",
    },
  },
);

type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  VariantProps<typeof buttonVariants> & {
    /** Figma "With icon" boolean — pass an IconName to render the leading icon; omit to hide it. */
    icon?: IconName;
  };

/**
 * Figma "With text" is expressed by the presence of `children`. An icon-only
 * button has no visible label and the `Icon` atom renders `aria-hidden`, so
 * TypeScript requires an explicit `aria-label` in that case — otherwise the
 * control would be unnamed for assistive tech (CLAUDE.md: accessibility is
 * part of the atom).
 */
export type ButtonProps =
  | (ButtonBaseProps & { children: ReactNode })
  | (ButtonBaseProps & { children?: never; "aria-label": string });

export function Button({
  variant,
  icon,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, className })}
      {...props}
    >
      {icon && (
        <span className="pr-1">
          <Icon name={icon} />
        </span>
      )}
      {children && <span className="pl-1 pr-2">{children}</span>}
    </button>
  );
}
