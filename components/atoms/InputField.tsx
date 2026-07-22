// figma: node-id=3705:4402
import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/InputField — Figma component set "Input-field" (node-id 3705:4402).
 *
 * Figma structure, mirrored 1:1:
 *   root (column, gap 8px)
 *   ├─ label TEXT            — Figma `Title` bool + `Field` text
 *   └─ "Container" (row, p-1, gap 12px, rounded-xl, 1px border, white fill)
 *      ├─ "Content" (column, gap 12px, fill)
 *      │  ├─ "Leading + Text" (row, py-2 pl-2, gap 8px) — leading icon + input
 *      │  └─ SLOT "Slot"      — Figma `Button` bool
 *      └─ "Trekking-icon-container" (row, py-2 pr-2, gap 8px) — trailing icon
 *
 * Figma property → code:
 * - `Field` (text) + `Title` (bool) → `label` (omit it to hide the label).
 * - `Content` (text)                → native `placeholder` / `value`.
 * - `Leading-icon` (bool)           → `leadingIcon?: IconName`.
 * - `Trekking-icon` (bool)          → `trailingIcon?: IconName`. "Trekking" is
 *   a Figma-side misnomer; the node sits after the content, so it is the
 *   TRAILING icon (translation recorded in `design/notes/InputField.md`).
 * - `Button` (bool) + SLOT node     → `button?: ReactNode` named slot, per
 *   CLAUDE.md (Figma SLOT ⇒ children/named slot, never a hardcoded instance) —
 *   so callers pass their own `<Button>` rather than this atom importing a
 *   sibling atom.
 *
 * States, re-read from the fetched node for #58 (the set grew a fourth
 * state, Selected, matching Button's shape — but its Default/Hover/Active
 * colours are still their own ramp, not Button's; see below):
 * - Default:  border stone-300, content stone-300 (placeholder copy).
 * - Hover:    border stone-500, content stone-300 (placeholder copy).
 * - Active:   border stone-600, content stone-300 (placeholder copy).
 * - Selected: border stone-400, content stone-950 ("typed" copy).
 *
 * All four are modelled. Figma labels states, not CSS hooks, so the mapping
 * below is this atom's reading — but it is the same reading `Atom/Button`
 * uses (see docs/design-tokens.md), which is what the states being renamed to
 * match Button's is presumably for:
 * - Hover    -> `:hover`.
 * - Active   -> `:active`. Figma's Active means "being pressed", which is
 *   exactly what CSS `:active` means; Button makes the same mapping.
 * - Selected -> `:focus-within`. This is the state whose sample shows a typed
 *   value instead of the placeholder, i.e. the field has been engaged — which
 *   is what `:focus-within` expresses. Note this moved: in the #53 fetch the
 *   typed-content sample sat on *Active*, which is why #53/#56 read Active as
 *   the focus state. This re-fetch moved it onto Selected, so the focus
 *   mapping moved with it.
 *
 * Flagged in `design/notes/InputField.md` for confirmation rather than treated as
 * settled. No ring/outline is added anywhere: Figma changes only the 1px
 * border colour per state, so a ring would invent an affordance the design
 * does not show — a weak keyboard-focus affordance is a real accessibility
 * concern, but it is a design question, not something to paper over here.
 *
 * TICKET #68 (2026-07-20): re-fetched this node (3705:4402) alongside
 * `Atom/Button` (3623:4346) again, since the user re-authored Button/Outline's
 * borders. Three of the four states now line up pixel-for-pixel: Default
 * already shared `border` (stone-300); Hover is now stone-500 on both
 * (Button's Hover moved from stone-400 to match this atom's existing value);
 * Selected is now stone-400 on both (Button's Outline gained a Selected
 * border for the first time). So `border-input-hover` and
 * `border-input-selected` are deleted and this atom now reads the shared
 * `border-hover` / `border-selected` tokens directly — no more
 * component-scoped duplicates for those two states.
 *
 * Active is the one state that still does NOT line up: this node's Active is
 * stone-600, Button/Outline's moved to stone-800 (from stone-700) — still a
 * real, confirmed pixel difference, not a stale/unbound node (re-fetched and
 * compared side by side, not assumed). `border-input-active` is kept,
 * unrenamed, as the single remaining, deliberately-flagged divergence — see
 * docs/design-tokens.md open question 1, rewritten this ticket to describe
 * just this one state instead of all three.
 *
 * Figma's `Text` boolean can hide the entire input row, leaving just the button
 * slot. Not modelled: an "input field" without its input is not a meaningful
 * state for this atom. Flagged in `design/notes/InputField.md` for triage rather
 * than silently supported.
 *
 * The placeholder colour uses `text-placeholder`; the container's border
 * states are covered above.
 *
 * Every padding/gap below is re-derived from the fetched dev-ready node (root
 * gap 8; container padding 4, gap 12; content gap 12; leading+text padding
 * 8/0/0/8 per the raw node, gap 8; trailing-icon padding 8/8/8/0) and was
 * already correct in the shipped version. What actually produced the
 * "spacing looks wrong throughout" report (#44) was the container's
 * cross-axis alignment: it was `items-center`, which vertically centers the
 * 32px-tall leading+text column inside the row's real 40px height (set by
 * the taller trailing-icon column), adding a phantom ~4px offset not present
 * in Figma. Figma's implicit top alignment gives a clean, uniform 12px inset
 * from the container border to the visible glyphs on all four sides (4px
 * container padding + 8px inner padding, top/left/right/bottom alike) —
 * reproduced here with `items-start`. NOT regressed by #78 below: `items-start`
 * is still required whenever the `button` slot renders (Content's column can
 * then be taller than the trailing-icon column, and Figma's own Container row
 * has no alignItems override, i.e. its default is top, not center).
 *
 * FIXED for #78 (2026-07-21): every fetched sample of this node has
 * `Trekking-icon` (trailing icon) visible=true — the component set's dev-ready
 * frames never exercise the "no trailing icon" case, so the raw node's
 * leading+text padding (8/0/0/8, no bottom) is only ever seen paired with the
 * trailing-icon column's symmetric 8/8/8/0, which is 40px tall and forces the
 * row (and so the whole bordered Container, hug-sized per Figma's own
 * `sizing.vertical: hug`) to 40 / 48px respectively regardless of the
 * leading+text row's own shorter 32px intrinsic height. Toggle the trailing
 * icon off in code and nothing forces that height anymore — the row's own
 * hug height (32px) becomes the max, and the bordered Container shrinks by
 * exactly the missing 8px of bottom padding. That is the reported bug
 * (WithLeadingIcon / WithoutIcons rendering shorter than WithTrailingIcon /
 * WithBothIcons). Fixed as "padding-derived, made symmetric" (the ticket's
 * second option, not a hardcoded fixed height — the Container's sizing really
 * is hug in Figma, so a literal `h-12` would misrepresent that): the
 * leading+text row's padding is now `py-2 pl-2` (symmetric 8/8, matching the
 * trailing-icon column's own already-symmetric `py-2`) instead of the raw
 * node's `pt-2 pl-2`. Its own intrinsic height is now 40px unconditionally, so
 * the row-max the bordered Container hugs to is 40px (and the container is
 * 48px) for all four icon combinations — none / leading-only / trailing-only
 * / both — with no dependency on which sibling is present. This is a
 * deliberate, flagged deviation from the literal per-state fetched padding
 * value on this one row (see `design/notes/InputField.md`), justified because the
 * fetched node structurally cannot demonstrate the no-trailing-icon case and
 * the ticket's own premise ("in Figma the container height does not depend on
 * the trailing icon being present") requires the two columns to agree on
 * height independently rather than one propping up the other.
 */
type InputFieldBaseProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  /** Figma `Leading-icon` — icon rendered before the input. */
  leadingIcon?: IconName;
  /** Figma `Trekking-icon` (= trailing) — icon rendered after the content. */
  trailingIcon?: IconName;
  /** Figma `Button` SLOT — rendered inside the container, below the input row. */
  button?: ReactNode;
  /** Merged onto the outermost wrapper; the inner input keeps its own classes. */
  className?: string;
};

/**
 * A visible `label` must be associated with the input. This atom is a Server
 * Component so it cannot call `useId()` — instead TypeScript requires an `id`
 * whenever a `label` is supplied, wiring `htmlFor`/`id` explicitly.
 */
export type InputFieldProps =
  | (InputFieldBaseProps & { label: string; id: string })
  | (InputFieldBaseProps & { label?: never });

export function InputField({
  label,
  leadingIcon,
  trailingIcon,
  button,
  className,
  ...props
}: InputFieldProps) {
  return (
    <div className={clsx("flex w-full flex-col gap-2", className)}>
      {label ? (
        <label
          htmlFor={props.id}
          className="text-base font-semibold text-text-muted"
        >
          {label}
        </label>
      ) : null}

      <div className="flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover active:border-border-input-active focus-within:border-border-selected">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-row items-center gap-2 self-stretch py-2 pl-2">
            {leadingIcon ? (
              <Icon name={leadingIcon} className="text-text-muted" />
            ) : null}
            <input
              {...props}
              className="w-full border-0 bg-transparent p-0 text-base font-semibold text-text placeholder:text-placeholder focus:outline-none"
            />
          </div>
          {button ? <div className="flex flex-row gap-2">{button}</div> : null}
        </div>

        {trailingIcon ? (
          <div className="flex flex-row items-center gap-2 py-2 pr-2">
            <Icon name={trailingIcon} className="text-text-muted" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
