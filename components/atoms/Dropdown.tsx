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

  // The first child (current selection) becomes the real disclosure
  // trigger: Dropdown injects aria-expanded/aria-controls/onClick onto
  // whatever interactive element the caller already supplied (a `Button`, or
  // a `<button>` wrapping a `Tag`) instead of wrapping it in a second
  // `<button>` — a button inside a button is invalid HTML. This makes
  // "caller supplies the trigger" the chosen API (the rejected alternative,
  // "Dropdown wraps the trigger itself", is documented in
  // design/notes/Dropdown.md along with why). The trigger element's own
  // Figma-authored button semantics carry through untouched.
  const trigger =
    label && isValidElement(selectedChild)
      ? cloneElement(selectedChild as ReactElement<TriggerProps>, {
          id: triggerId,
          "aria-expanded": isOpen,
          "aria-controls": panelId,
          onClick: (event: MouseEvent<HTMLButtonElement>) => {
            (selectedChild as ReactElement<TriggerProps>).props.onClick?.(event);
            setIsOpen((open) => !open);
          },
        })
      : selectedChild;

  return (
    <div
      // rounded-xl (#112): the inner panel below is already rounded-xl: an
      // unrounded outer box made caller className (TeDoenHeader.tsx's
      // `shadow-sm`) paint a square-cornered shadow behind it — confirmed in
      // a real browser, see design/notes/Dropdown.md. In labelless mode this
      // wrapper's box is pixel-identical to the panel's (single child, no
      // padding), so the fix is exact there; in labelled mode the corners
      // land on the label+panel group, invisible today since no caller
      // currently themes that box.
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
        // `gap-1` (labelless only): with a label, the sub-list's own `pt-1`
        // replaces it — a parent gap would survive the `0fr` collapse and
        // leave dead space below the closed panel. See design/notes/Dropdown.md.
        className={clsx(
          "flex w-full flex-col rounded-xl border border-border bg-surface p-1",
          !label && "gap-1",
        )}
        {...rest}
      >
        {label ? (
          <>
            {/* Trigger row (#112): re-fetching 3779:4938 (desktop AddItem)
                shows the Container/Content columns FILL, only the innermost
                Slot/Button stays hug — a chevron rendered by Dropdown itself
                in a fixed trailing column, not by the trigger, matching
                Input-field's own trailing-icon layout. Supersedes #100's
                `items-start` (hug) reading, which only inspected the
                innermost Slot. See design/notes/Dropdown.md. */}
            <div className="flex w-full items-center gap-3">
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
              // `self-stretch`: the panel now defaults to `items-stretch`
              // (#112 dropped the old `items-start`), so this is a no-op
              // today — kept explicit since the open option rows inside are
              // Figma `alignSelf: stretch, horizontal: fill` and must not
              // silently start hugging if the panel's default ever changes.
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
