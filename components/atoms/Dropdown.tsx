"use client";

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
 * Atom/Dropdown — Figma component "Dropdown" (node-id 3705:4446).
 *
 * Figma structure, mirrored 1:1 (re-fetched via MCP for ticket #61, single
 * COMPONENT — no variant/state axis, unlike Input-field's component set; the
 * component's only `propertyDefinitions` are `Field` (text) and `Title`
 * (bool) — Figma models no open/closed *state* at all):
 *   root (column, gap 8px)
 *   ├─ label TEXT      — Figma `Title` bool + `Field` text
 *   └─ SLOT "Slot" (column, p-1, gap 4px, rounded-xl, 1px border, white fill)
 *      — always present in the tree (not gated by a bool), holds arbitrary
 *        content; the fetched example fills it with three Button/Default
 *        instances (first "Style=Filled" i.e. selected, the other two
 *        "Style=White") demonstrating a selectable option list.
 *
 * Ticket #61 finding — the fetched node does not resolve what "closed" looks
 * like. There is no State/variant axis on this component, so the single
 * frame Figma returns is one static composition (all three options stacked),
 * not a distinct "closed" example — the fetched node neither confirms nor
 * contradicts the ticket's reference screenshot pixel-for-pixel, it simply
 * has nothing to say about a collapsed state at all (a screenshot description
 * cannot itself be re-verified against a node that models no such state).
 * Given that, and since the previous behaviour (collapsing the whole bordered
 * region to zero height, leaving only the label) is clearly wrong product
 * behaviour for a disclosure whose job is picking one option, the fix below
 * keeps the fetched node's own ordering — first child stays visible as the
 * "current selection", the remaining children are what the disclosure
 * toggles. This is the least invented interpretation available: it reuses
 * exactly the composition Figma already provides, just splits *which part*
 * animates instead of drawing new UI.
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
 *   open) carrying `aria-expanded` + `aria-controls` pointing at the id of
 *   the collapsible region (see below — ticket #61 narrowed exactly what
 *   that region is). The previous `role="group"` on the panel is dropped in
 *   this case — the ticket is right that it stops being the correct
 *   semantics once the container actually opens and closes: the WAI-ARIA
 *   disclosure pattern needs no role on the content region itself, only the
 *   trigger's aria-expanded/aria-controls pair, so an unnecessary role isn't
 *   invented to replace it. Escape closes the panel and returns focus to the
 *   trigger (handled on the root, so it fires no matter which slotted child
 *   has focus).
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
 * Ticket #61 — closed state fix: the bordered panel itself (border/bg/
 * padding) is now *always* rendered, and only its first child (the current
 * selection, per the fetched node's own ordering) is guaranteed visible.
 * The remaining children are what the disclosure actually toggles: the
 * CSS-grid `0fr`/`1fr` trick from ticket #43 still drives their reveal, it
 * just now wraps only the "rest of the options" sub-list instead of the
 * whole bordered region. Before #61: closing hid the entire panel (border
 * included), so a closed Dropdown showed nothing but its label — not what
 * either the reference screenshot or a sane collapsed-select control should
 * do. After #61: closing hides everything *except* the first child, so a
 * closed Dropdown always shows the label plus one bordered option. This is
 * a `Dropdown.tsx` behavioural change, not just a story change, per the
 * ticket. Only applies when `label` is present — the labelless mode has no
 * trigger at all (see above) and keeps rendering every child unconditionally.
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
      /** Initial open state of the disclosure. Defaults to `true`, matching the fetched Figma node (which samples only the fully-open state). When `false`, the first child stays visible (ticket #61) — only the remaining children are hidden. */
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

  // Ticket #61: the first child is the "current selection" and stays visible
  // whether the disclosure is open or closed (matches the fetched node's own
  // ordering — a Filled/selected Button first, White options after). Only
  // the remaining children are what open/close actually toggles. Without a
  // `label` there is no disclosure at all (see the doc comment above), so
  // every child renders unconditionally in that mode.
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
        className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface p-1"
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
                  // `inert` (not just `aria-hidden`) keeps the remaining
                  // options from being Tab-focusable while this sub-list is
                  // visually collapsed to zero height — `aria-hidden` alone
                  // hides content from assistive tech but does not remove
                  // focusable descendants from the tab order. The first/
                  // selected child sits outside this wrapper and is never
                  // hidden or made inert (ticket #61).
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
