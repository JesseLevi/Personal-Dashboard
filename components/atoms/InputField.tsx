// figma: node-id=3705:4402
import { cn } from "@/lib/ui/cn";
import { hasNativePicker } from "@/lib/ui/open-picker";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon";
import { InputFieldPickerInput } from "./InputFieldPickerInput";

/**
 * Atom/InputField — Figma "Input-field" (node-id 3705:4402). Full history:
 * `design/notes/InputField.md`.
 * `Field`+`Title` → `label`; `Leading-icon`/`Trekking-icon` (Figma misnomer
 * for trailing) → `leadingIcon`/`trailingIcon`; `Button` SLOT → `button`.
 * `multiline` (#94) → `<textarea>` in a fixed 144px box. `options` (#149) →
 * native `<select>`: Figma models Personen/Eenheid as this same field with a
 * chevron, never `Atom/Dropdown` — native select for free OS/a11y semantics.
 * States → CSS: Hover → `:hover`, Active → `:active`, Selected →
 * `:focus-within` (flagged for design confirmation); `stroke-primary-active`
 * diverges from Button/Outline on purpose — see open-questions.md.
 * `boxClassName`/clickable `<label>`s — see their own doc comments (#166).
 * `onTrailingIconClick` (#231) swaps the trailing `<label>` for a real
 * `<button>` — see its own type comment below.
 */
type InputFieldSharedProps = {
  /** Figma `Leading-icon` — icon rendered before the input. */
  leadingIcon?: IconName;
  /** Replaces `leadingIcon` with any node of icon size, e.g. the colour dot of a category select (#532). */
  leading?: ReactNode;
  /** Figma `Trekking-icon` (= trailing) — icon rendered after the content. */
  trailingIcon?: IconName;
  /** Figma `Button` SLOT — rendered inside the container, below the input row. */
  button?: ReactNode;
  /** Merged onto the outermost wrapper; the inner control keeps its own classes. */
  className?: string;
  /**
   * Merged onto the bordered interactive box (the div carrying
   * `hover:border-stroke-primary-hover`/`active:border-stroke-primary-active`/
   * `focus-within:border-stroke-primary-selected`) — narrow escape hatch for a
   * composed molecule whose REAL focusable control isn't a descendant of
   * this box (e.g. `ImageUploadField`'s real `<input type="file">` sits
   * beside a decorative, `aria-hidden` `InputField`, so this box's own
   * `:hover`/`:active`/`:focus-within` never fire — the sibling input can't
   * trigger them). Pass `peer-*` variants keyed off a `peer` class on that
   * sibling instead (#166). Every other caller leaves this unset.
   */
  boxClassName?: string;
} & (
  | { onTrailingIconClick?: undefined; trailingIconLabel?: undefined }
  | {
      /** #231: renders the trailing icon as a real `<button>` (its own accessible name via `trailingIconLabel`) instead of the plain click-to-focus `<label>` -- e.g. the search field's clear/X trigger, a distinct action from focusing the field. See design/notes/InputField.md. */
      onTrailingIconClick: () => void;
      trailingIconLabel: string;
    }
);

type InputFieldSingleLineProps = InputFieldSharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
    multiline?: false;
    options?: never;
    placeholderOption?: never;
  };

type InputFieldMultilineProps = InputFieldSharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    /** Renders a `<textarea>` in the fixed-height (144px) shape Figma's Omschrijving sample uses, instead of the single-line `<input>`. */
    multiline: true;
    options?: never;
    placeholderOption?: never;
  };

export interface InputFieldSelectOption {
  value: string;
  label: string;
}

type InputFieldSelectProps = InputFieldSharedProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    multiline?: false;
    /** Renders a native `<select>` instead of `<input>` — pair with `trailingIcon="ChevronDown"` for the Figma chevron. */
    options: InputFieldSelectOption[];
    /** Rendered as a disabled, unselectable first `<option value="">` for "nothing chosen yet" — `<select>` has no native `placeholder` attribute. */
    placeholderOption?: string;
  };

type InputFieldBaseProps =
  | InputFieldSingleLineProps
  | InputFieldMultilineProps
  | InputFieldSelectProps;

/**
 * A visible `label` must be associated with the input. This atom is a Server
 * Component so it cannot call `useId()` — instead TypeScript requires an `id`
 * whenever a `label` is supplied, wiring `htmlFor`/`id` explicitly.
 */
export type InputFieldProps =
  | (InputFieldBaseProps & { label: string; id: string })
  | (InputFieldBaseProps & { label?: never });

// spacing-flag: p-0 resets native UA padding, not Figma-sourced. design/notes/InputField.md.
const NATIVE_CONTROL_BASE = "border-0 bg-transparent p-0 text-base font-semibold text-text-primary";

export function InputField({
  label,
  leadingIcon,
  leading,
  trailingIcon,
  onTrailingIconClick,
  trailingIconLabel,
  button,
  className,
  boxClassName,
  multiline,
  options,
  placeholderOption,
  id,
  ...props
}: InputFieldProps) {
  // #149: the text row's own bottom padding only drops when `button` is
  // present (the Figma-correct "8px 0px 0px 8px" reading for every instance
  // — see design/notes/InputField.md) so a plain input/textarea with no
  // `button` renders pixel-identically to before this ticket, and only the
  // reported "step field has a dead 8px gap above its button pill" case
  // moves. Same reasoning for the multiline+button container height: fixed
  // at Figma's 124px instead of the plain-multiline 144px, with the row
  // flexing (not `h-full`) to share that height with the button row.
  const hasButtonRow = Boolean(button);
  const SingleLineInput = hasNativePicker((props as { type?: string }).type) ? InputFieldPickerInput : "input";

  return (
    <div className={cn("flex w-full flex-col gap-stack-sm", className)}>
      {label ? (
        <label htmlFor={id} className="text-base font-semibold text-text-secondary">
          {label}
        </label>
      ) : null}

      {/* items-start, not items-center: keeps the leading+text row's top edge aligned instead of centering it inside the taller trailing-icon column. */}
      <div
        className={cn(
          "flex flex-row items-start justify-center gap-stack-md rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs transition-colors hover:border-stroke-primary-hover active:border-stroke-primary-active focus-within:border-stroke-primary-selected",
          multiline && (hasButtonRow ? "h-[124px]" : "h-36"),
          boxClassName,
        )}
      >
        {/* self-stretch: only takes effect when the container has a fixed
            height (multiline) — gives the row below a real, definite height
            to flex against instead of `h-full` resolving against an
            indefinite (hug) parent. */}
        <div className="flex flex-1 flex-col gap-stack-md self-stretch">
          {/* A real `<label htmlFor={id}>`, not a `<div>` (#166): browsers
              natively delegate a click anywhere in this row — including the
              leading icon — to the control, and exclude the control's own
              value from this label's accessible-name contribution (same
              recursion-safe rule the classic `<label>Text <input></label>`
              pattern relies on). Deliberately does NOT wrap `button` below,
              so that slot's own text never leaks into this label's name. */}
          <label
            htmlFor={id}
            className={cn(
              "flex flex-row gap-inline-sm self-stretch pl-component-sm",
              hasButtonRow ? "pt-component-sm" : "py-component-sm",
              multiline ? "min-h-0 flex-1 items-start" : "items-center",
            )}
          >
            {leading ??
              (leadingIcon ? <Icon name={leadingIcon} className="text-text-secondary" /> : null)}
            {multiline ? (
              <textarea
                id={id}
                {...(props as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">)}
                className={`${NATIVE_CONTROL_BASE} h-full w-full resize-none placeholder:text-placeholder focus:outline-none`}
              />
            ) : options ? (
              <select
                id={id}
                {...(props as Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">)}
                className={`${NATIVE_CONTROL_BASE} w-full appearance-none focus:outline-none`}
              >
                {placeholderOption !== undefined ? (
                  <option value="" disabled hidden>
                    {placeholderOption}
                  </option>
                ) : null}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <SingleLineInput
                id={id}
                {...(props as Omit<InputHTMLAttributes<HTMLInputElement>, "className">)}
                className={`${NATIVE_CONTROL_BASE} w-full placeholder:text-placeholder focus:outline-none`}
              />
            )}
          </label>
          {/* spacing-flag: gap-2 button row unbound in Figma. design/notes/InputField.md. */}
          {button ? <div className="flex flex-row gap-2">{button}</div> : null}
        </div>

        {trailingIcon ? (
          onTrailingIconClick ? (
            <button
              type="button"
              onClick={onTrailingIconClick}
              aria-label={trailingIconLabel}
              // spacing-flag: gap-2 trailing-icon control unbound in Figma. design/notes/InputField.md.
              className="chrome-touch flex flex-row items-center gap-2 rounded-control border-0 bg-transparent py-component-sm pr-component-sm transition-colors hover:bg-surface-secondary-hover active:bg-surface-secondary-active"
            >
              <Icon name={trailingIcon} className="text-text-secondary" />
            </button>
          ) : (
            <label
              htmlFor={id}
              // spacing-flag: gap-2 trailing-icon label unbound in Figma. design/notes/InputField.md.
              className="flex flex-row items-center gap-2 py-component-sm pr-component-sm"
            >
              <Icon name={trailingIcon} className="text-text-secondary" />
            </label>
          )
        ) : null}
      </div>
    </div>
  );
}
