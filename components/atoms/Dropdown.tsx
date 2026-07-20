// figma: node-id=3705:4446
import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Atom/Dropdown — Figma component "Dropdown" (node-id 3705:4446).
 *
 * Figma structure, mirrored 1:1 (fetched via MCP, single COMPONENT — no
 * variant/state axis, unlike Input-field's component set):
 *   root (column, gap 8px)
 *   ├─ label TEXT      — Figma `Title` bool + `Field` text
 *   └─ SLOT "Slot" (column, p-1, gap 4px, rounded-xl, 1px border, white fill)
 *      — always present in the tree (not gated by a bool), holds arbitrary
 *        content; the fetched example fills it with three Button/Default
 *        instances demonstrating a selectable option list.
 *
 * Figma property → code:
 * - `Field` (text) + `Title` (bool) → `label` (omit it to hide the label).
 *   Same discriminated-union idiom as InputField: supplying `label` requires
 *   `id` (this is a Server Component, so it cannot call `useId()`); the id is
 *   applied to the label element and referenced via `aria-labelledby`.
 * - SLOT "Slot" → `children: ReactNode` (required — Figma never hides it),
 *   per CLAUDE.md "Figma SLOT ⇒ children/named slot, never a hardcoded
 *   instance". The composing organism is responsible for what it puts in the
 *   slot (e.g. real `Button` instances for a category picker).
 *
 * `Step`, `Leading-icon`, and `Trekking-icon` briefly existed as dangling
 * `propertyDefinitions` (bound to no layer) and were removed from the Figma
 * component on 2026-07-20 after triage — no longer part of the node, so
 * nothing to model here.
 *
 * States: this component has no `State` property in Figma (unlike
 * Input-field's Default/Hover component set), so no hover/active override is
 * added — inventing one would violate "Figma State -> CSS pseudo-classes"
 * (there is no State to translate here).
 *
 * Colours all map to existing semantic tokens with no gap: white (panel fill)
 * -> `surface`, stone-300 (panel stroke) -> `border`, stone-500 (label fill)
 * -> `text-muted`.
 */
type DropdownBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "children"
> & {
  /** Figma SLOT `Slot` — arbitrary content rendered inside the bordered panel. */
  children: ReactNode;
  /** Merged onto the outermost wrapper; the inner group container keeps its own classes. */
  className?: string;
};

/**
 * A visible `label` must be associated with the group. Same pattern as
 * InputField: TypeScript requires an `id` whenever `label` is supplied,
 * wiring it to `aria-labelledby` explicitly (no `useId()` in a Server
 * Component).
 */
export type DropdownProps =
  | (DropdownBaseProps & { label: string; id: string })
  | (DropdownBaseProps & { label?: never });

/**
 * Accessibility decision: the fetched node models no trigger, no
 * expand/collapse affordance, and no combobox/select semantics — just a
 * label plus a bordered container of arbitrary slotted content. Because the
 * slot's children are caller-supplied (not owned by this atom, exactly like
 * InputField's `button` slot), this atom cannot assert `role="listbox"` +
 * `role="option"` without knowing the children satisfy that contract. It
 * therefore renders the container as a purely presentational, deliberately
 * minimal `role="group"` labelled via `aria-labelledby` — a valid grouping
 * role regardless of what's slotted in. Any real listbox/combobox semantics
 * (aria-expanded, aria-selected, keyboard handling) belong to the organism
 * that composes actual selectable options into the slot, not this leaf atom.
 */
export function Dropdown({
  label,
  id,
  children,
  className,
  ...rest
}: DropdownProps) {
  return (
    <div className={clsx("flex w-full flex-col gap-2", className)}>
      {label ? (
        <span id={id} className="text-base font-semibold text-text-muted">
          {label}
        </span>
      ) : null}

      <div
        role="group"
        aria-labelledby={label ? id : undefined}
        className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-1"
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}
