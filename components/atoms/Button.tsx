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
 * 2026-07-20 for ticket #56, which supersedes #52's matrix: Figma added a
 * FOURTH state (Active) and redistributed the values. What #52 modelled as
 * Hover is now Active; Hover took a milder new value; and Selected no longer
 * changes the background at all — it only darkens the text.
 * - Filled: bg surface-raised, text text-muted; hover bg surface-raised-hover;
 *   active bg surface-raised-active; selected keeps the default bg and only
 *   moves text -> text.
 * - White: bg surface, text text-muted; hover bg surface-hover; active bg
 *   surface-active; selected keeps the default bg, text -> text.
 * - Transparent: no fill, text-muted; selected text -> text. Figma defines no
 *   fill change for its Hover or Active nodes, so none is invented — meaning a
 *   transparent button has no pointer affordance at all. Flagged in
 *   design/figma-map.json rather than papered over with a made-up tint.
 * - Outline: bg-transparent, 1px border-border, text-muted; hover border ->
 *   border-hover; active border -> border-active; selected keeps the default
 *   border, text -> text.
 * - Destructive ("Distructive" in Figma): bg priority-urgent-bg, text
 *   priority-urgent; hover bg -> priority-urgent-bg-hover; active bg ->
 *   priority-urgent-bg-active; Selected is identical to Default (Figma changes
 *   neither fill nor text), so this style gets no aria-pressed override.
 *
 * Selected composes with Hover and Active by construction, which is a stated
 * product requirement (a selected button must still react to the pointer).
 * That works because the two concerns touch disjoint CSS properties: Selected
 * only sets `color`, Hover/Active only set `background-color`/`border-color`.
 * So no `aria-pressed:bg-*` or `aria-pressed:border-*` override may be added
 * here — doing so would re-introduce the conflict.
 *
 * `active:` is the right hook for Figma's new Active state: CSS `:active`
 * means "currently being pressed", which is exactly what that state depicts.
 * Ticket #42 removed `active:` from this component, but for a different
 * reason that still stands — it was being misused there for the *persistent*
 * Selected state, which is `aria-pressed`, not `:active`. Both hooks now
 * coexist deliberately; don't "fix" one back into the other.
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
 * State colours read from dedicated per-role state tokens — see
 * docs/design-tokens.md for the `role` / `role-hover` / `role-active`
 * convention every future component should follow. The `*-selected` colour
 * tokens #52 added were removed in #56: Selected no longer has a background
 * of its own, so those names had no consumer left.
 *
 * `border-hover` (stone-400) is this component's Outline hover.
 * `Atom/Input-field` reads its own provisional `border-input-hover` /
 * `border-input-focus` pair instead, because its Figma node still carries the
 * pre-rework three-state scale — and notably its Hover stroke is *darker*
 * than its Active one, the reverse of the ordering here, which is the
 * strongest evidence that node was never re-bound to the reworked variables.
 * Open question recorded in docs/design-tokens.md; once Figma is reconciled
 * both components collapse onto one border scale.
 *
 * Dark mode (ticket #42, extended #52/#56): these are semantic-token classes
 * only (no `dark:` utility prefixes anywhere below) — light/dark is a
 * token-layer concern. Every token this component reads carries a dark
 * override in design/tokens.json, emitted by `pnpm sync:tokens` into a
 * `[data-theme="dark"]` block in app/theme.css. No Figma dark-mode frames
 * exist for this component, so the dark shades are this codebase's own pick,
 * kept inside Tailwind's stock stone/red scale (never a one-off hex). Known
 * gap: the destructive hover/active pair both resolve to red-950 in dark
 * mode, so those states are invisible there.
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
          "bg-surface-raised text-text-muted hover:bg-surface-raised-hover active:bg-surface-raised-active aria-pressed:text-text",
        outline:
          "border border-border bg-transparent text-text-muted hover:border-border-hover active:border-border-active aria-pressed:text-text",
        white:
          "bg-surface text-text-muted hover:bg-surface-hover active:bg-surface-active aria-pressed:text-text",
        transparent: "bg-transparent text-text-muted aria-pressed:text-text",
        destructive:
          "bg-priority-urgent-bg text-priority-urgent hover:bg-priority-urgent-bg-hover active:bg-priority-urgent-bg-active",
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
