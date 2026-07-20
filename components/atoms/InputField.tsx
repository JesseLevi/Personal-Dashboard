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
 *      │  ├─ "Leading + Text" (row, pt-2 pl-2, gap 8px) — leading icon + input
 *      │  └─ SLOT "Slot"      — Figma `Button` bool
 *      └─ "Trekking-icon-container" (row, py-2 pr-2, gap 8px) — trailing icon
 *
 * Figma property → code:
 * - `Field` (text) + `Title` (bool) → `label` (omit it to hide the label).
 * - `Content` (text)                → native `placeholder` / `value`.
 * - `Leading-icon` (bool)           → `leadingIcon?: IconName`.
 * - `Trekking-icon` (bool)          → `trailingIcon?: IconName`. "Trekking" is
 *   a Figma-side misnomer; the node sits after the content, so it is the
 *   TRAILING icon (translation recorded in `design/figma-map.json`).
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
 * - Selected: border stone-400, content stone-950 ("typed" copy). Not
 *   modelled — see below.
 *
 * Figma names the third state "Active", not "Focus" — this atom reads it as
 * the keyboard/pointer focus state (`:focus-within`) because it is the only
 * interaction state left in the set with no dedicated trigger of its own
 * (Hover has `:hover`; Selected, see below, has no input-shaped trigger
 * either, so Active is the remaining candidate for "the user is engaged with
 * this field"). That is our reading of intent, not a labelled Figma state;
 * flagged in `design/figma-map.json` for confirmation rather than assumed
 * silently. Worth noting for whoever confirms it: in the #53 fetch, Active's
 * sample showed typed (stone-950) content text, which was this reading's main
 * evidence. In this re-fetch that "typed" sample moved onto the new Selected
 * state instead — Active's content text is now plain placeholder-grey, same
 * as Default/Hover. The `:focus-within` mapping is kept per the ticket's own
 * fallback rule (no state is literally named "Focus"), but the qualitative
 * signal behind it has shifted, so it's flagged again rather than silently
 * carried forward as settled.
 *
 * The container therefore draws its own state per fetched stroke:
 * `border-border` (stone-300) at rest, `hover:border-border-input-hover`
 * (stone-500), `focus-within:border-border-input-active` (stone-600). No
 * ring/outline is added: Figma's Active instance only changes the 1px border
 * colour, so a ring would be inventing an affordance the design doesn't show.
 *
 * Not shared with `Atom/Button`: Button's Outline style reads `border-hover`
 * (stone-400) / `border-active` (stone-700) for the same two interactions,
 * but this node's Hover/Active pixels are different (stone-500/stone-600).
 * Ticket #56 assumed that divergence was a stale, unbound Figma node and left
 * it behind two PROVISIONAL tokens pending reconciliation. Ticket #58
 * re-fetched expecting that reconciliation to have landed (the node did grow
 * a fourth state, matching Button's shape) — it re-fetched the same
 * conclusion instead: Default lines up with Button's Default (stone-300, so
 * it reads the shared `border` token), but Hover/Active do not line up with
 * Button's Hover/Active, and the old three-state ordering bug (Hover darker
 * than Active) is fixed, which reads as a deliberate, stable ramp rather than
 * an authoring leftover. So `border-input-hover` / `border-input-active`
 * (renamed from `border-input-focus`, its old name for the same fetched
 * pixel this ticket relabels stone-600) are no longer described as
 * provisional — see docs/design-tokens.md open question 1 for the full
 * history.
 *
 * Figma's new Selected state (border stone-400, content stone-950) is not
 * modelled here: there is no interaction affordance on a plain `<input>`
 * analogous to Button's `aria-pressed`, so building one would be inventing
 * behaviour Figma doesn't specify how to trigger. Flagged in
 * `design/figma-map.json` for design/triage rather than guessed at.
 *
 * Flagged honestly (both recorded in design/figma-map.json too): (1) the
 * Active→Focus mapping above is this atom's interpretation, not a Figma
 * label, and the signal behind it shifted between fetches — worth
 * confirming with design; (2) a 1px border-colour change is a weak focus
 * affordance for keyboard users (no ring, no outline, low contrast against
 * the stone-300 default), and Figma offers nothing stronger in this node —
 * flagged as a design question rather than compensated for with an invented
 * ring/outline.
 *
 * Deliberately NOT the `accent` token: #45 established that `accent`'s purple
 * entered the codebase from a Figma canvas artifact (the dashed stroke marking
 * a selected component set), not from any design intent, and removed it from
 * `Checkbox`. Reusing it here would have re-introduced the same wrong colour.
 *
 * Figma's `Text` boolean can hide the entire input row, leaving just the button
 * slot. Not modelled: an "input field" without its input is not a meaningful
 * state for this atom. Flagged in `design/figma-map.json` for triage rather
 * than silently supported.
 *
 * The placeholder colour uses `text-placeholder`; the container's border
 * states are covered above.
 *
 * Every padding/gap below is re-derived from the fetched dev-ready node (root
 * gap 8; container padding 4, gap 12; content gap 12; leading+text padding
 * 8/0/0/8, gap 8; trailing-icon padding 8/8/8/0) and was already correct in
 * the shipped version. What actually produced the "spacing looks wrong
 * throughout" report was the container's cross-axis alignment: it was
 * `items-center`, which vertically centers the 32px-tall leading+text column
 * inside the row's real 40px height (set by the taller trailing-icon column),
 * adding a phantom ~4px offset not present in Figma. Figma's implicit top
 * alignment gives a clean, uniform 12px inset from the container border to
 * the visible glyphs on all four sides (4px container padding + 8px inner
 * padding, top/left/right/bottom alike) — reproduced here with `items-start`.
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

      <div className="flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-input-hover focus-within:border-border-input-active">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-row items-center gap-2 self-stretch pl-2 pt-2">
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
