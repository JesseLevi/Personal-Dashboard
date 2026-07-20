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
 * States: only Hover differs from Default on the container (border stone-300
 * → stone-500). Figma's "Active" instance keeps the same container styling as
 * Default; its only difference is the content text's fill going from
 * `text-placeholder` (stone-300, placeholder copy) to `text` (stone-950,
 * "typed" copy) — i.e. it demonstrates placeholder-vs-value contrast, not a
 * distinct interaction state. That's already what happens for free: the
 * `<input>` uses `text-text` with a `placeholder:text-placeholder` override,
 * so real typed text renders dark and the placeholder renders muted. No
 * `active:` CSS override is added because there is nothing left to add.
 *
 * Figma's set (Default/Hover/Active, per above) has no distinct Focus state.
 * #15 left the browser's native input focus ring as the only affordance, but
 * that ring outlines just the `<input>` box — which is much smaller than the
 * component frame (no padding/border of its own) — so it rendered as a small
 * rectangle floating inside the rounded pill, not aligned to its corners
 * (issue #44). Fixed by suppressing the native ring (`focus:outline-none` on
 * the `<input>`) and drawing the focus indicator on the whole container
 * instead (`focus-within:ring-2 focus-within:ring-inset ring-accent`), sized
 * to the container's real 12px corner radius. No Figma focus state exists to
 * source a color from, so this borrows the `accent` token by analogy to
 * `Checkbox`'s checked state (the codebase's existing precedent for "accent =
 * active interactive affordance") — flagged in `design/figma-map.json` for
 * design review rather than left without any visible focus indicator.
 *
 * Figma's `Text` boolean can hide the entire input row, leaving just the button
 * slot. Not modelled: an "input field" without its input is not a meaningful
 * state for this atom. Flagged in `design/figma-map.json` for triage rather
 * than silently supported.
 *
 * The placeholder colour and hover border use the dedicated `text-placeholder`
 * and `border-hover` semantic tokens (added to design/tokens.json 2026-07-20).
 * They resolve to the same stone-300/stone-500 primitives Figma uses, but are
 * named for their role — `border-hover` is shared with `Button`.
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

      <div className="flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent">
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
