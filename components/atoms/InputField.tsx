// figma: node-id=3705:4402
import clsx from "clsx";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/InputField — Figma "Input-field" (node-id 3705:4402). Full history:
 * `design/notes/InputField.md`.
 * `Field`+`Title` → `label`; `Leading-icon`/`Trekking-icon` (Figma misnomer
 * for trailing) → `leadingIcon`/`trailingIcon`; `Button` SLOT → `button`.
 * `multiline` (#94) → `<textarea>` in a fixed 144px box. `options` (#149) →
 * native `<select>`: Figma models Personen/Eenheid as this same field with a
 * chevron, never `Atom/Dropdown` — native select for free OS/a11y semantics.
 * States → CSS: Hover → `:hover`, Active → `:active`, Selected →
 * `:focus-within` (this atom's own interpretation, flagged for design
 * confirmation); `border-input-active` diverges from Button/Outline on
 * purpose — docs/open-questions.md#button-vs-input-active-border.
 * `boxClassName` (#166) — see its own doc comment below.
 */
type InputFieldSharedProps = {
  /** Figma `Leading-icon` — icon rendered before the input. */
  leadingIcon?: IconName;
  /** Figma `Trekking-icon` (= trailing) — icon rendered after the content. */
  trailingIcon?: IconName;
  /** Figma `Button` SLOT — rendered inside the container, below the input row. */
  button?: ReactNode;
  /** Merged onto the outermost wrapper; the inner control keeps its own classes. */
  className?: string;
  /**
   * Merged onto the bordered interactive box (the div carrying
   * `hover:border-border-hover`/`active:border-border-input-active`/
   * `focus-within:border-border-selected`) — narrow escape hatch for a
   * composed molecule whose REAL focusable control isn't a descendant of
   * this box (e.g. `ImageUploadField`'s real `<input type="file">` sits
   * beside a decorative, `aria-hidden` `InputField`, so this box's own
   * `:hover`/`:active`/`:focus-within` never fire — the sibling input can't
   * trigger them). Pass `peer-*` variants keyed off a `peer` class on that
   * sibling instead (#166). Every other caller leaves this unset.
   */
  boxClassName?: string;
};

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

export function InputField({
  label,
  leadingIcon,
  trailingIcon,
  button,
  className,
  boxClassName,
  multiline,
  options,
  placeholderOption,
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

      {/* items-start, not items-center: keeps the leading+text row's top edge aligned instead of centering it inside the taller trailing-icon column. */}
      <div
        className={clsx(
          "flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover active:border-border-input-active focus-within:border-border-selected",
          multiline && (hasButtonRow ? "h-[124px]" : "h-36"),
          boxClassName,
        )}
      >
        {/* self-stretch: only takes effect when the container has a fixed
            height (multiline) — gives the row below a real, definite height
            to flex against instead of `h-full` resolving against an
            indefinite (hug) parent. */}
        <div className="flex flex-1 flex-col gap-3 self-stretch">
          <div
            className={clsx(
              "flex flex-row gap-2 self-stretch pl-2",
              hasButtonRow ? "pt-2" : "py-2",
              multiline ? "min-h-0 flex-1 items-start" : "items-center",
            )}
          >
            {leadingIcon ? (
              <Icon name={leadingIcon} className="text-text-muted" />
            ) : null}
            {multiline ? (
              <textarea
                {...(props as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">)}
                className="h-full w-full resize-none border-0 bg-transparent p-0 text-base font-semibold text-text placeholder:text-placeholder focus:outline-none"
              />
            ) : options ? (
              <select
                {...(props as Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">)}
                className="w-full appearance-none border-0 bg-transparent p-0 text-base font-semibold text-text focus:outline-none"
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
              <input
                {...(props as Omit<InputHTMLAttributes<HTMLInputElement>, "className">)}
                className="w-full border-0 bg-transparent p-0 text-base font-semibold text-text placeholder:text-placeholder focus:outline-none"
              />
            )}
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
