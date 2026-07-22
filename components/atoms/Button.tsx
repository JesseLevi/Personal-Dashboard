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
 *   icon. Labelled buttons (icon+text or text-only) reproduce Figma's nested
 *   Icon/Text frame padding exactly (root pl-2 pr-1, icon wrapper pr-1, text
 *   wrapper pl-1 pr-2 — text-only: 12px/12px, both: 8px left / 12px right).
 *   Icon-only `size="default"` is NOT built from that same padding sum
 *   (fixed for ticket #75 — see the `size` variant's doc comment): it's a
 *   structural `size-10` square with the icon centred by `justify-center`,
 *   matching Figma's fetched 40x40 icon-only instances, rather than an
 *   emergent total that happened to land on the right number.
 *
 * Per-state fills/text, read from the fetched node and resolved to primitives
 * via design/tokens.json (exact Figma hex values live in `design/notes/Button.md`,
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
 *   `design/notes/Button.md` rather than papered over with a made-up tint.
 * - Outline: bg-transparent, 1px border-border, text-muted; hover border ->
 *   border-hover; active border -> border-active; selected border ->
 *   border-selected (re-fetched for ticket #68 — Outline's Selected state
 *   gained a border change for the first time since #56, previously "border
 *   unchanged, text -> text"), text -> text.
 * - Destructive ("Distructive" in Figma): bg priority-urgent-bg, text
 *   priority-urgent; hover bg -> priority-urgent-bg-hover; active bg ->
 *   priority-urgent-bg-active; Selected is identical to Default (Figma changes
 *   neither fill nor text), so this style gets no aria-pressed override.
 *
 * Selected composes with Hover and Active by construction, which is a stated
 * product requirement (a selected button must still react to the pointer).
 * For every style except Outline this still works because the two concerns
 * touch disjoint CSS properties: Selected only sets `color`, Hover/Active only
 * set `background-color`. So no `aria-pressed:bg-*` override may be added to
 * Filled/White/Transparent/Destructive — doing so would re-introduce that
 * conflict, per docs/design-tokens.md.
 *
 * Outline is the exception (ticket #68): its Selected state now sets
 * `border-color`, the same property Hover/Active already use, so the three
 * genuinely compete for the first time. A plain `aria-pressed:border-*`
 * override is NOT safe on its own here — verified against the compiled
 * `pnpm ladle:build` stylesheet, not assumed: Tailwind emits
 * `.aria-pressed\:border-border-selected[aria-pressed=true]` *after*
 * `.hover\:border-border-hover:hover` and `.active\:border-border-active:active`
 * in the generated CSS, and all three have equal specificity (one class +
 * one pseudo-class/attribute selector each), so per the cascade the later
 * rule — aria-pressed — would win on a selected button that's also being
 * hovered/pressed, silently killing its hover/active feedback. Fixed with
 * compound variants (`aria-pressed:hover:border-border-hover`,
 * `aria-pressed:active:border-border-active`) that match only when Selected
 * combines with Hover/Active: each compiles to a selector with one extra
 * pseudo-class/attribute term than the plain rules (three total vs two), so
 * it has strictly higher specificity and wins regardless of the stylesheet's
 * emission order — a property of CSS specificity, not an assumption about
 * Tailwind's internal variant ordering. See the PR for the grepped compiled
 * rules.
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
 * `border-hover` (stone-500) and `border-selected` (stone-400) are this
 * component's Outline Hover/Selected, and (ticket #68) are now shared with
 * `Atom/Input-field`, whose re-fetched node carries the identical pixels for
 * both states. `border-active` (stone-800) stays Button-only: Input-field's
 * Active is stone-600, a real, confirmed pixel difference, not a stale node —
 * it keeps its own `border-input-active` token. This is the one remaining
 * divergence; see docs/open-questions.md#button-vs-input-active-border.
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
 *
 * Flex-shrink defence (ticket #80): `shrink-0` lives on the shared base
 * class string, not per-size, so it applies to every size/variant
 * combination unconditionally. Measured in a real browser (Playwright
 * against `pnpm ladle`, no headless-markup workaround): `CardContentIngredient`'s
 * destructive icon-only Trash `Button` (stated `size-10`, 40x40) rendered at
 * 35.1x40 inside that molecule's width-constrained row, because a flex item
 * defaults to `flex-shrink: 1` and nothing on this atom opted out. This is
 * the same failure class #69/#75 already named for padding-derived
 * footprints, arriving here through flex-shrink instead: a size stated by
 * the component is not the size the browser renders once a composer's
 * layout has less room than the row wants. `shrink-0` is placed on the atom
 * itself, not left to each call site, because a fixed-footprint control
 * (icon-only `compact`/`iconOnlyDefault`, and arguably the labelled
 * `default` size too — Figma never shows any Button variant compressing)
 * has no layout in which shrinking below its stated size is ever correct;
 * requiring every composer to remember a `className="shrink-0"` is exactly
 * the kind of per-call-site duty that already went missing twice in this
 * codebase (`CardContentIngredient`'s Checkbox and Trash Button both lacked
 * it) before `ButtonToggle` was found to be the only defended call site.
 * `ButtonToggle.tsx`'s own segments no longer need a local `shrink-0` for
 * this reason — it would be redundant now that the atom asserts it.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center rounded-lg text-base font-semibold transition-colors",
  {
    variants: {
      /**
       * Figma's Button set has no Size property — but `Button/Toggle`
       * (3623:4345) resizes its nested Button instances to 32x32 via an
       * instance override, which is a real, design-sourced footprint that a
       * caller cannot reproduce with a `className`: `h-8` and `h-10` are the
       * same property at the same specificity, so which one wins depends on
       * Tailwind's own utility ordering, not on the order the caller wrote
       * them. Hence a variant. The pixels are Figma's; only the API shape is
       * ours.
       *
       * `justify-start`/`justify-center` live here, per size, instead of on
       * the shared base above — `size` is a single CVA slot (exactly one of
       * its strings is ever emitted), so putting a conflicting utility per
       * slot can never put two rules for the same CSS property on the same
       * element. Doing it via a plain conditional class instead would
       * reproduce the exact `h-8`/`h-10` hazard this doc already warns about:
       * which of two same-specificity utilities wins would depend on
       * Tailwind's generation order, not on which one the caller means.
       *
       * `compact` (ticket #69): originally `h-8 pl-1 pr-0`, a 32px width that
       * only *totalled* correctly (4px inset + Icon's default 24px + 4px
       * inset) rather than being stated — any future change to the icon's
       * default size or the wrapper padding below would silently de-square
       * it. Now `size-8` states width equal to height directly (one utility,
       * verified against the actual rendered markup — see `ButtonToggle.tsx`'s
       * doc for how), and `justify-center` centres the icon instead of
       * relying on padding either side to land symmetrically. Verified for
       * the icon-only case only (all Figma samples). Pairing it with
       * `children` is not merely untested — a fixed 32x32 box clips a label —
       * so the props union below makes that combination unrepresentable.
       *
       * `iconOnlyDefault` (ticket #75): the same bug class #69 already fixed
       * for `compact`, now fixed for `default`. Measured by rendering to
       * static markup and reading the resolved utility classes (no headless
       * browser in this repo, same method #69 used): `default`'s old classes
       * (`h-10 justify-start pl-2 pr-1`) plus an icon span carrying no
       * padding when icon-only (see the wrapper comment below) summed to
       * `pl-2` (8) + Icon's default 24px + `pr-1` (4) = 36px, against a fixed
       * `h-10` = 40px — 4px short of Figma's fetched 40x40 square (component
       * set 3623:4346, e.g. the Distructive/Default instance with `With
       * text` overridden false, and 40x40 samples throughout
       * `Card-container`/3650:1297 and `Card-content/Ingredient`/3727:4378).
       * This key is not exposed on the public `size` prop (see `ButtonProps`
       * below) — the component resolves to it internally whenever `size` is
       * `default` (or omitted) and there is no label, mirroring `compact`'s
       * own icon-only-only footprint. `size-10` states width equal to height
       * directly, the same structural move `compact` made: a future change
       * to the Icon's default size or to the icon wrapper's padding can no
       * longer silently de-square this box, because its width no longer
       * comes from summing them — it's a fixed 40x40 with `justify-center`
       * centring the icon, not padding arithmetic landing on 40 by
       * coincidence.
       *
       * `default` (labelled case) is unchanged: a labelled button must keep
       * hugging its text with the current asymmetric `pl-2 pr-1` padding
       * (Figma's own root padding on every sampled Button/Default instance),
       * so only the icon-only branch gets the structural treatment.
       */
      size: {
        default: "h-10 justify-start pl-2 pr-1",
        compact: "size-8 justify-center",
        iconOnlyDefault: "size-10 justify-center",
      },
      variant: {
        filled:
          "bg-surface-raised text-text-muted hover:bg-surface-raised-hover active:bg-surface-raised-active aria-pressed:text-text",
        outline:
          "border border-border bg-transparent text-text-muted hover:border-border-hover active:border-border-active aria-pressed:border-border-selected aria-pressed:hover:border-border-hover aria-pressed:active:border-border-active aria-pressed:text-text",
        white:
          "bg-surface text-text-muted hover:bg-surface-hover active:bg-surface-active aria-pressed:text-text",
        transparent: "bg-transparent text-text-muted aria-pressed:text-text",
        destructive:
          "bg-priority-urgent-bg text-priority-urgent hover:bg-priority-urgent-bg-hover active:bg-priority-urgent-bg-active",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  },
);

type ButtonBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  /**
   * `size` is re-typed here rather than taken as-is from `VariantProps`:
   * `iconOnlyDefault` (see the `size` variant's doc comment above) is an
   * internal-only cva key the component resolves to itself — callers only
   * ever choose between the two real Figma-facing sizes.
   */
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    /** Figma "With icon" boolean — pass an IconName to render the leading icon; omit to hide it. */
    icon?: IconName;
    size?: "default" | "compact";
  };

/**
 * Figma "With text" is expressed by the presence of `children`. An icon-only
 * button has no visible label and the `Icon` atom renders `aria-hidden`, so
 * TypeScript requires an explicit `aria-label` in that case — otherwise the
 * control would be unnamed for assistive tech (CLAUDE.md: accessibility is
 * part of the atom).
 */
export type ButtonProps =
  /**
   * `size` is narrowed to `"default"` on the branch that carries a label:
   * `compact` is a fixed 32x32 box (`size-8`), so a label would be clipped by
   * it rather than merely looking cramped. Figma only ever samples `compact`
   * icon-only, so this makes the unsupported combination unrepresentable
   * instead of leaving it as a comment nobody reads at the call site.
   */
  | (ButtonBaseProps & { children: ReactNode; size?: "default" })
  | (ButtonBaseProps & { children?: never; "aria-label": string });

export function Button({
  variant,
  size,
  icon,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  /**
   * `compact` is untouched (icon-only-only per its own type narrowing above,
   * so it's already square). `default` is where ticket #75 lives: the
   * labelled branch's type only ever allows `size` to be `"default"` or
   * omitted, so `children` truthy implies plain `default`; icon-only
   * (`children` falsy) with `size` `"default"` or omitted resolves to the
   * internal `iconOnlyDefault` key instead, giving it the structural 40x40
   * footprint rather than the labelled branch's hug-with-asymmetric-padding
   * one. See the `size` variant's doc comment for the measurement.
   */
  const resolvedSize =
    !children && size !== "compact" ? "iconOnlyDefault" : (size ?? "default");
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size: resolvedSize, className })}
      {...props}
    >
      {/*
        The icon wrapper's trailing `pr-1` only exists to open a gap before a
        label that follows it — with no `children`, keeping it would push the
        icon off-centre inside a centred icon-only box (`size="compact"`'s
        `size-8` or `size="default"`'s icon-only `size-10`, ticket #69/#75),
        so it is applied only when there is a label to separate from.
      */}
      {icon && (
        <span className={children ? "pr-1" : undefined}>
          <Icon name={icon} />
        </span>
      )}
      {children && <span className="pl-1 pr-2">{children}</span>}
    </button>
  );
}
