"use client";

// figma: node-id=3705:4446
import clsx from "clsx";
import {
  Children,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Atom/Dropdown — Figma "Dropdown" (node-id 3705:4446). Single COMPONENT, no
 * variant/state axis. Full history: `design/notes/Dropdown.md`.
 *
 * `Field`+`Title` → `label` (requires `id`); SLOT `Slot` → required
 * `children`. Figma has no open/closed state, so "closed" is this atom's own
 * interpretation: panel chrome always renders, first child (current
 * selection) always visible, only the rest collapse. Client Component:
 * open/closed is intrinsic, identical-for-every-caller behaviour.
 *
 * Flagged gap: a labelless Dropdown has no header to become a trigger, so it
 * stays a static always-open `role="group"`, not a real disclosure.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = label ? `${id}-panel` : undefined;

  // First child is the "current selection" and always stays visible; only
  // the rest collapse. See the doc comment above.
  const [selectedChild, ...restChildren] = Children.toArray(children);

  function handleRootKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (label && isOpen && event.key === "Escape") {
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      className={clsx("flex w-full flex-col gap-2", className)}
      onKeyDown={label ? handleRootKeyDown : undefined}
    >
      {label ? (
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((open) => !open)}
          className="w-fit bg-transparent p-0 text-left text-base font-semibold text-text-muted"
        >
          {label}
        </button>
      ) : null}

      <div
        role={label ? undefined : "group"}
        // `gap-1` only in labelless mode: with a label, the sub-list's own
        // `pt-1` replaces it — a parent gap would survive the `0fr` collapse
        // and leave dead space below the closed panel. See design/notes/Dropdown.md.
        className={clsx(
          "flex w-full flex-col rounded-xl border border-border bg-surface p-1",
          !label && "gap-1",
        )}
        {...rest}
      >
        {label ? (
          <>
            {selectedChild}
            <div
              id={panelId}
              className={clsx(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
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
