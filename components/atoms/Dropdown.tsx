"use client";

// figma: node-id=3705:4446
import { cn } from "@/lib/ui/cn";
import {
  Children,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

/**
 * Atom/Dropdown — Figma "Dropdown" (node-id 3705:4446). Single COMPONENT, no
 * variant/state axis. Full history: `design/notes/Dropdown.md`.
 *
 * `Field`+`Title` → `label` (requires `id`); SLOT `Slot` → required
 * `children`, whose first child is the current selection. When labelled,
 * Dropdown owns the one `<button>` (the disclosure trigger) that spans the
 * whole row: the first child is rendered inside it, next to Dropdown's own
 * chevron, so it must be non-interactive (a `Tag`, or a `Button` with
 * `presentational`). The label is a native `<label for>` of that button, so
 * clicking it opens the list too. Figma has no open/closed state, so
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

  return (
    <div
      // `rounded-control-outer` here, not just on the panel: without it a
      // caller's `shadow-sm` paints square corners behind the rounded panel.
      // See design/notes/Dropdown.md.
      className={cn(
        "flex w-full flex-col gap-stack-sm rounded-control-outer",
        className,
      )}
      onKeyDown={label ? handleRootKeyDown : undefined}
    >
      {label ? (
        <label
          id={id}
          htmlFor={triggerId}
          className="w-fit cursor-pointer text-base font-semibold text-text-secondary"
        >
          {label}
        </label>
      ) : null}

      <div
        role={label ? undefined : "group"}
        // `gap-1` labelless only — reasoning: design/notes/Dropdown.md.
        // Border states are labelled-only on purpose: labelled Dropdown is a
        // field (user-reported, must match InputField's own ramp and tokens),
        // while labelless is a floating menu panel, where a hover border on
        // the panel would fight its option rows' own hover.
        className={cn(
          "flex w-full flex-col rounded-control-outer border border-stroke-primary bg-surface-highlight-white p-component-xs",
          label
            ? "transition-colors hover:border-stroke-primary-hover active:border-stroke-primary-active focus-within:border-stroke-primary-selected"
            : "gap-inline-xs",
        )}
        {...rest}
      >
        {label ? (
          <>
            {/* Trigger row: ONE button owns the selection and the chevron.
                The chevron is Dropdown's own fixed trailing column, never the
                caller's. See design/notes/Dropdown.md. */}
            <button
              type="button"
              id={triggerId}
              // spacing-flag: `gap-3` trigger row — no measurable Figma
              // node (Slot's own fetched children have no separate
              // trigger+chevron wrapper frame to read). design/notes/Dropdown.md.
              className="flex w-full cursor-pointer items-center gap-3 text-left"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-labelledby={`${id} ${triggerId}`}
              onClick={() => setIsOpen((open) => !open)}
            >
              <span className="min-w-0 flex-1">{selectedChild}</span>
              <Icon
                name="ChevronDown"
                className={cn(
                  "mr-2 shrink-0 text-text-secondary transition-transform duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            <div
              id={panelId}
              aria-labelledby={id}
              // `self-stretch` is a no-op today but kept explicit: the option
              // rows are Figma fill and must not start hugging if the panel's
              // default alignment ever changes.
              className={cn(
                "grid self-stretch transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div
                  aria-hidden={!isOpen}
                  // `inert` is required alongside `aria-hidden`: aria-hidden alone doesn't remove focusable descendants from the tab order.
                  inert={!isOpen}
                  // spacing-flag: `gap-1 pt-1` — same reasoning as the
                  // trigger row's gap-3 above (no measurable Figma node).
                  // design/notes/Dropdown.md.
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
