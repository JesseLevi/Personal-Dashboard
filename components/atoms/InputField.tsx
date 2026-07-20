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
 * States, re-read from the fetched node for #53 (the semantic variables were
 * reworked since #44, and the set now carries three genuinely distinct
 * container strokes):
 * - Default: border stone-300, content stone-300 (placeholder copy).
 * - Hover:   border stone-500, content stone-300 (placeholder copy).
 * - Active:  border stone-400, content stone-950 ("typed" copy).
 *
 * Figma names the third state "Active", not "Focus" — this atom reads it as
 * the keyboard/pointer focus state (`:focus-within`) because it is the only
 * interaction state left in the set and its sample shows a typed value, which
 * only makes sense once the field has been engaged. That is our reading of
 * intent, not a labelled Figma state; flagged in `design/figma-map.json` for
 * confirmation rather than assumed silently.
 *
 * The container therefore draws its own state per fetched stroke:
 * `border-border` (stone-300) at rest, `hover:border-border-hover`
 * (stone-500), `focus-within:border-border-selected` (stone-400, new token —
 * see design/tokens.json). No ring/outline is added: Figma's Active instance
 * only changes the 1px border colour, so a ring would be inventing an
 * affordance the design doesn't show. The typed-vs-placeholder text contrast
 * already happens for free via the `<input>`'s `text-text` +
 * `placeholder:text-placeholder` classes, so no extra class is needed for it.
 *
 * Flagged honestly (both recorded in design/figma-map.json too): (1) the
 * Active→Focus mapping above is this atom's interpretation, not a Figma
 * label — worth confirming with design; (2) a 1px border-colour change is a
 * weak focus affordance for keyboard users (no ring, no outline, low
 * contrast against the stone-300 default), and Figma offers nothing
 * stronger in this node — flagged as a design question rather than
 * compensated for with an invented ring/outline.
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
 * The placeholder colour uses `text-placeholder`. The hover and focus strokes
 * read `border-input-hover` (stone-500) and `border-input-focus` (stone-400),
 * two PROVISIONAL, component-scoped tokens introduced in #56.
 *
 * Why component-scoped: `Atom/Button` was re-authored in Figma with a four-
 * state scale (Default/Hover/Active/Selected) whose Outline strokes are
 * stone-300 / stone-400 / stone-700 — each state darker than the last. This
 * node was re-fetched in the same ticket and still carries the older three-
 * state scale, stone-300 / stone-500 / stone-400, where Hover is *darker*
 * than Active. That inversion is almost certainly an authoring leftover: this
 * node was never re-bound to the reworked variables. Rather than normalise
 * one component to the other by guessing, both keep their fetched values and
 * this component's live behind names that announce themselves as temporary.
 * When Figma is reconciled, delete these two tokens and read the shared
 * `border-hover` / `border-active` scale instead.
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

      <div className="flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-input-hover focus-within:border-border-input-focus">
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
