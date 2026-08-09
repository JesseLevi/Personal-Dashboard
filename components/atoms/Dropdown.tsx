"use client";

// figma: node-id=3705:4446
import clsx from "clsx";
import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

/**
 * Atom/Dropdown — Figma "Dropdown" (node-id 3705:4446). Single COMPONENT, no
 * variant/state axis. Full history: `design/notes/Dropdown.md`.
 *
 * `Field`+`Title` → `label` (requires `id`); SLOT `Slot` → required
 * `children`, whose first child is both the current selection AND the
 * disclosure trigger (caller-supplied — see the trigger-ownership note
 * below); the title renders as inert text. When labelled, Dropdown renders
 * its own trailing chevron next to the trigger (#112) — the caller's trigger
 * must NOT render its own trailing icon. Figma has no open/closed state, so
 * "closed" is this atom's own interpretation: panel chrome always renders,
 * first child always visible, only the rest collapse. Client Component:
 * open/closed is intrinsic, identical-for-every-caller behaviour.
 */
type DropdownBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "children"
> & {
  /** Figma SLOT `Slot` — arbitrary content rendered inside the bordered panel. */
  children: ReactNode;
  /** Merged onto the outermost wrapper; the inner panel keeps its own classes. */
  className?: string;
};

/**
 * A visible `label` must be associated with the disclosure. Same pattern as
 * InputField: TypeScript requires an `id` whenever `label` is supplied.
 * `defaultOpen` only makes sense once there is a trigger to toggle it, so the
 * no-label branch disallows it entirely (type-enforced) rather than silently
 * ignoring it.
 */
export type DropdownProps =
  | (DropdownBaseProps & {
      label: string;
      id: string;
      /** Initial open state. Defaults to `true` (fetched node only samples fully-open). When `false`, the first child stays visible — only the rest are hidden. */
      defaultOpen?: boolean;
    })
  | (DropdownBaseProps & { label?: never; defaultOpen?: never });

type TriggerProps = {
  id?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
};

export function Dropdown({
  label,
  id,
  children,
  className,
  defaultOpen = true,
  ...rest
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = label ? `${id}-trigger` : undefined;
  const panelId = label ? `${id}-panel` : undefined;

  // First child is the "current selection" and always stays visible; only
  // the rest collapse. See the doc comment above.
  const [selectedChild, ...restChildren] = Children.toArray(children);

  function focusTrigger() {
    if (triggerId) document.getElementById(triggerId)?.focus();
  }

  function handleRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (label && isOpen && event.key === "Escape") {
      event.stopPropagation();
      setIsOpen(false);
      focusTrigger();
    }
  }

  // The first child becomes the disclosure trigger by injecting aria-* onto
  // the caller's own interactive element — never by wrapping it in a second
  // `<button>`, which would be invalid HTML. See design/notes/Dropdown.md.
  const trigger =
    label && isValidElement(selectedChild)
      ? cloneElement(selectedChild as ReactElement<TriggerProps>, {
          id: triggerId,
          "aria-expanded": isOpen,
          "aria-controls": panelId,
        })
      : selectedChild;

  return (
    <div
      // `rounded-xl` here, not just on the panel: without it a caller's
      // `shadow-sm` paints square corners behind the rounded panel. See
      // design/notes/Dropdown.md.
      className={clsx("flex w-full flex-col gap-2 rounded-xl", className)}
      onKeyDown={label ? handleRootKeyDown : undefined}
    >
      {label ? (
        <span id={id} className="w-fit text-base font-semibold text-text-muted">
          {label}
        </span>
      ) : null}

      <div
        role={label ? undefined : "group"}
        // `gap-1` labelless only — reasoning: design/notes/Dropdown.md.
        // Border states are labelled-only on purpose: labelled Dropdown is a
        // field (user-reported, must match InputField's own ramp and tokens),
        // while labelless is a floating menu panel, where a hover border on
        // the panel would fight its option rows' own hover.
        className={clsx(
          "flex w-full flex-col rounded-xl border border-border bg-surface p-1",
          label
            ? "transition-colors hover:border-border-hover active:border-border-input-active focus-within:border-border-selected"
            : "gap-1",
        )}
        {...rest}
      >
        {label ? (
          <>
            {/* Trigger row: the chevron is Dropdown's own fixed trailing
                column, never the trigger's. See design/notes/Dropdown.md. */}
            <div
              className="flex w-full cursor-pointer items-center gap-3"
              onClick={() => setIsOpen((open) => !open)}
            >
              <div className="min-w-0 flex-1">{trigger}</div>
              <Icon
                name="ChevronDown"
                className={clsx(
                  "mr-2 shrink-0 text-text-muted transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
                  isOpen && "rotate-180",
                )}
              />
            </div>
            <div
              id={panelId}
              aria-labelledby={id}
              // `self-stretch` is a no-op today but kept explicit: the option
              // rows are Figma fill and must not start hugging if the panel's
              // default alignment ever changes.
              className={clsx(
                "grid self-stretch transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div
                  aria-hidden={!isOpen}
                  // `inert` is required alongside `aria-hidden`: aria-hidden alone doesn't remove focusable descendants from the tab order.
                  inert={!isOpen}
                  className="flex flex-col gap-1 pt-1"
                >
                  {restChildren}
                </div>
              </div>
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
