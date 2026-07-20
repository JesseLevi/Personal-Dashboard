"use client";

import clsx from "clsx";
import {
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Atom/Dropdown — Figma component "Dropdown" (node-id 3705:4446).
 *
 * Figma structure, mirrored 1:1 (re-fetched via MCP for ticket #43, single
 * COMPONENT — no variant/state axis, unlike Input-field's component set):
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
 *   `id`. This atom is now a Client Component (see below) and could in
 *   principle call `useId()`, but the `label`+`id` contract is kept identical
 *   to InputField's Server-Component idiom on purpose — one consistent way
 *   to label a slotted atom across the design system, not two.
 * - SLOT "Slot" → `children: ReactNode` (required — Figma never hides it),
 *   per CLAUDE.md "Figma SLOT ⇒ children/named slot, never a hardcoded
 *   instance". The composing organism still owns *what* goes in the slot
 *   (e.g. real `Button` instances for a category picker) — only the
 *   show/hide chrome around it now belongs to this atom (see below).
 *
 * `Step`, `Leading-icon`, and `Trekking-icon` briefly existed as dangling
 * `propertyDefinitions` (bound to no layer) and were removed from the Figma
 * component on 2026-07-20 after triage — no longer part of the node, so
 * nothing to model here.
 *
 * Colours all map to existing semantic tokens with no gap: white (panel fill)
 * -> `surface`, stone-300 (panel stroke) -> `border`, stone-500 (label fill)
 * -> `text-muted`. No token gaps found for this ticket either — the
 * open/close animation below uses Tailwind's built-in duration/easing scale,
 * not a project token, so nothing was added to design/tokens.json.
 *
 * ---
 *
 * Architectural decision for ticket #43 (open/close interaction):
 *
 * CLAUDE.md's house style keeps presentational atoms as Server Components,
 * with interactivity wired by the composing molecule/organism — modelled
 * exactly that way by `InputField`, whose `button` slot is caller-supplied
 * *content* that the atom itself never wires an onClick to. A disclosure is a
 * different shape of problem: open/closed-ness isn't content, it's the
 * atom's own behaviour, identical for every caller (toggle on trigger click,
 * animate the same way, close on Escape). Lifting that state to every
 * composing molecule would mean re-implementing the same open/close/Escape
 * logic at each call site with zero variation — the opposite of what "the
 * composer wires interactivity" is meant to buy. So: **state lives inside
 * this atom** (`"use client"`), the same way a native `<details>` owns its
 * own open attribute. The slot contract that made InputField's Server
 * Component shape work — arbitrary caller-supplied `children`/`button` — is
 * unchanged here; only the chrome wrapping that slot became interactive.
 *
 * Accessibility follows the choice, and only applies when there is something
 * to disclose *to*:
 * - When `label` is supplied, the label becomes the real trigger: a native
 *   `<button>` (so Enter/Space "for free" — no keydown handling needed to
 *   open) carrying `aria-expanded` + `aria-controls` pointing at the panel's
 *   id. The previous `role="group"` on the panel is dropped in this case —
 *   the ticket is right that it stops being the correct semantics once the
 *   container actually opens and closes: the WAI-ARIA disclosure pattern
 *   needs no role on the content region itself, only the trigger's
 *   aria-expanded/aria-controls pair, so an unnecessary role isn't invented
 *   to replace it. Escape closes the panel and returns focus to the trigger
 *   (handled on the root, so it fires no matter which slotted child has
 *   focus).
 * - When no `label` is supplied there is no header at all in Figma to turn
 *   into a trigger, and inventing one (e.g. a generic unlabelled toggle
 *   button) would be new UI not in the fetched node. That configuration
 *   keeps the previous static behaviour exactly: content always rendered,
 *   `role="group"` with no accessible name (unchanged from before this
 *   ticket). This is a deliberate, flagged gap — a labelless Dropdown cannot
 *   be a real disclosure without either a design update (add a header/trigger
 *   to the Figma node) or a caller passing its own trigger via a future named
 *   slot; recorded in design/figma-map.json for triage.
 * - No chevron/indicator icon was added to the trigger. The fetched node
 *   samples no such affordance (no State axis, no icon layer next to the
 *   label), and adding one would be inventing UI beyond what Figma shows.
 *   Flagged as a possible follow-up design question rather than freelanced.
 *
 * Animation: the panel height is driven by the CSS-grid `0fr`/`1fr` row
 * trick (`grid-rows-[0fr]` / `grid-rows-[1fr]` + `overflow-hidden` on the
 * inner wrapper) so it animates without JS measuring the content height —
 * purely Tailwind utility classes, no inline styles. Duration/easing use
 * Tailwind's built-in scale (no project token exists for motion timing yet).
 * `motion-reduce:transition-none` removes the animation for
 * `prefers-reduced-motion` users, per CLAUDE.md.
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
      /** Initial open state of the disclosure. Defaults to `true`, matching the fetched Figma node (which samples only the fully-open state). */
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
        id={panelId}
        className={clsx(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          !label || isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            role={label ? undefined : "group"}
            aria-hidden={label ? !isOpen : undefined}
            // `inert` (not just `aria-hidden`) keeps slotted children from
            // being Tab-focusable while the panel is visually collapsed to
            // zero height — `aria-hidden` alone hides content from
            // assistive tech but does not remove focusable descendants from
            // the tab order.
            inert={label ? !isOpen : undefined}
            className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-1"
            {...rest}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
