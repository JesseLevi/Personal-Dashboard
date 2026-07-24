// figma: node-id=3705:4402
import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Atom/InputField — Figma "Input-field" (node-id 3705:4402). Full history:
 * `design/notes/InputField.md`.
 *
 * `Field`+`Title` → `label`; `Leading-icon`/`Trekking-icon` (Figma misnomer
 * for trailing) → `leadingIcon`/`trailingIcon`; `Button` SLOT → `button`.
 * `multiline` (#94, cards.description) → `<textarea>` instead of `<input>`,
 * same fixed-height container Figma shows (144px) rather than a growing box.
 * States → CSS: Hover → `:hover`, Active → `:active`, Selected →
 * `:focus-within` — this atom's own interpretation, flagged for design
 * confirmation. `border-input-active` is a deliberate component-scoped
 * token divergence from Button/Outline (docs/open-questions.md#button-vs-input-active-border).
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
};

type InputFieldSingleLineProps = InputFieldSharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
    multiline?: false;
  };

type InputFieldMultilineProps = InputFieldSharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    /** Renders a `<textarea>` in the fixed-height (144px) shape Figma's Omschrijving sample uses, instead of the single-line `<input>`. */
    multiline: true;
  };

type InputFieldBaseProps = InputFieldSingleLineProps | InputFieldMultilineProps;

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
  multiline,
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

      {/* items-start, not items-center: keeps the leading+text row's top edge aligned instead of centering it inside the taller trailing-icon column. */}
      <div
        className={clsx(
          "flex flex-row items-start justify-center gap-3 rounded-xl border border-border bg-surface p-1 transition-colors hover:border-border-hover active:border-border-input-active focus-within:border-border-selected",
          multiline && "h-36",
        )}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div
            className={clsx(
              "flex flex-row gap-2 self-stretch py-2 pl-2",
              multiline ? "h-full items-start" : "items-center",
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
