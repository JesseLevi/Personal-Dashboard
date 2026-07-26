// figma: node-id=3674:5664
import clsx from "clsx";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664).
 * Variant axis: `Collapsed` (No/Yes) -> `collapsed` prop. Six modules ->
 * fixed `NAV_ITEMS` list (not a `children` slot — Figma hardcodes these
 * six). Active item -> Button's `Style=Filled, State=Selected`
 * (`variant="filled"` + `aria-pressed`). `bg-surface-muted` is Figma's
 * fill (#109) — same token `AppShellNav`'s wrapper already carries, so this
 * is a no-op on desktop by coincidence; it's load-bearing for the mobile
 * drawer, which has no ambient background of its own. See design/notes/
 * Sidebar.md. Nav-item Buttons render one element
 * across both states — label stays in the DOM, `overflow-hidden` +
 * `whitespace-nowrap` clip it as the rail shrinks, instead of swapping
 * icon-only/labelled Buttons (#109). Full rationale, measurements,
 * history: design/notes/Sidebar.md.
 */
export type SidebarItemId =
  | "todo"
  | "notes"
  | "recipes"
  | "shopping"
  | "clothes"
  | "assistant";

const NAV_ITEMS: ReadonlyArray<{ id: SidebarItemId; icon: IconName }> = [
  { id: "todo", icon: "Columns3" },
  { id: "notes", icon: "Notebook" },
  { id: "recipes", icon: "FolderClosed" },
  { id: "shopping", icon: "ShoppingBasket" },
  { id: "clothes", icon: "Shirt" },
  { id: "assistant", icon: "Astroid" },
];

// Explicit-px constants, not `w-fit` — CSS can't transition `width` to/from
// an intrinsic-sizing keyword, only between two literal lengths. 73px (not
// the 72px pad+icon+pad arithmetic suggests) accounts for Preflight's
// border-box folding in this <nav>'s 1px border; see design/notes/Sidebar.md.
// Exported (#101) so `AppShellNav`'s fixed-sidebar layout spacer can reuse
// the exact same widths instead of a second hardcoded pair.
export const SIDEBAR_EXPANDED_WIDTH = "w-[198px]";
export const SIDEBAR_COLLAPSED_WIDTH = "w-[73px]";

export interface SidebarProps {
  /** Figma `Collapsed` variant axis (No/Yes). Defaults to expanded (`No`). */
  collapsed?: boolean;
  /** Accessible name for the root `<nav>` landmark. */
  navLabel: string;
  /** Icon-only toggle's accessible name — pick the text for the state a click would move TO (e.g. "Expand sidebar" while collapsed). */
  toggleLabel: string;
  /** Forwarded to the toggle button's `onClick`. */
  onToggle?: () => void;
  /** The fixed module matching the current page/route, if any. */
  activeItem?: SidebarItemId;
  /** One label per fixed module — composer-supplied, see `messages/*.json` `components.sidebar.items.*`. */
  labels: Record<SidebarItemId, string>;
  /** Fired with the item id when a module link is clicked. */
  onNavigate?: (item: SidebarItemId) => void;
  className?: string;
}

// Server Component: `collapsed` stays a plain prop, not internal state —
// where it's persisted (cookie/localStorage/URL) varies by caller, same
// reasoning as Atom/Checkbox's `checked`.
export function Sidebar({
  collapsed = false,
  navLabel,
  toggleLabel,
  onToggle,
  activeItem,
  labels,
  onNavigate,
  className,
}: SidebarProps) {
  return (
    <nav
      aria-label={navLabel}
      className={clsx(
        // duration-[var(--duration-base)] MUST stay arbitrary-value form:
        // `--duration-*` isn't a Tailwind v4 theme namespace, so a bare
        // `duration-base` class compiles to nothing.
        // GAP: --duration-base/--ease-base values are unsourced from Figma
        // (no prototype spec exists) — see
        // docs/open-questions.md#sidebar-motion-timing-unsourced.
        "flex h-full flex-col items-end gap-12 border-r border-border bg-surface-muted p-4 transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        className,
      )}
    >
      <Button
        variant="filled"
        icon={collapsed ? "PanelLeftOpen" : "PanelLeftClose"}
        aria-label={toggleLabel}
        onClick={onToggle}
      />
      <div className="flex w-full flex-col gap-3">
        {NAV_ITEMS.map(({ id, icon }) => {
          const isActive = id === activeItem;
          const variant = isActive ? "filled" : "transparent";
          const label = labels[id];
          const handleClick = onNavigate ? () => onNavigate(id) : undefined;

          // Same Button element in both states — label stays as `children`
          // and gets clipped by `overflow-hidden`/`whitespace-nowrap` as
          // this flex item's stretched width shrinks with the rail, instead
          // of swapping icon-only/labelled Buttons. `aria-label` mirrors
          // `children` verbatim (never a different or state-dependent
          // string) — required because Button's icon+text markup loses its
          // content-computed accessible name in real browsers; see
          // design/notes/Sidebar.md (#109).
          return (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              aria-pressed={isActive || undefined}
              onClick={handleClick}
              className="overflow-hidden whitespace-nowrap"
            >
              {label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
