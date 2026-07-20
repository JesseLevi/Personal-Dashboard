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
 * States: only Hover differs from Default (border stone-300 → stone-500);
 * Figma's Active state is identical to Default, so no `active:` override is
 * added and no focus style is invented — the native focus ring on the inner
 * `<input>` is deliberately left intact as the only focus affordance.
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

      <div className="flex flex-row items-center justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-row items-center gap-2 self-stretch pl-2 pt-2">
            {leadingIcon ? (
              <Icon name={leadingIcon} className="text-text-muted" />
            ) : null}
            <input
              {...props}
              className="w-full border-0 bg-transparent p-0 text-base font-semibold text-text placeholder:text-placeholder"
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
