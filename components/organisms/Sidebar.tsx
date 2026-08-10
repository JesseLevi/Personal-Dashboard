// figma: node-id=3674:5664
import clsx from "clsx";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664).
 * Variant axis: `Collapsed` (No/Yes) -> `collapsed` prop. Six modules ->
 * fixed `NAV_ITEMS` list. Active item -> Button's `Style=Filled,
 * State=Selected`. `bg-surface-muted` is Figma's fill; nav-item Buttons
 * render one element across both states (`overflow-hidden` clips the
 * label as the rail shrinks). Full rationale + measurements: design/notes/
 * Sidebar.md.
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

// Explicit-px, not `w-fit` — CSS can't transition to/from an intrinsic
// keyword. 73px (not 72) accounts for border-box folding the 1px border;
// see design/notes/Sidebar.md. Exported so AppShellNav's spacer reuses them.
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
        // duration-[var(--duration-base)] must stay arbitrary-value form
        // (bare `duration-base` compiles to nothing); GAP: value unsourced
        // from Figma, see docs/open-questions.md#sidebar-motion-timing-unsourced.
        "flex h-full flex-col items-end gap-12 border-r border-border bg-surface-muted p-4 transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        // pt-/pb- (#113): `max()` only ever adds space over the existing 16px,
        // so this is a no-op wherever there is no safe-area inset (desktop,
        // most phones) — only extends the top/bottom padding on notched /
        // home-indicator devices when this atom fills the mobile drawer
        // edge-to-edge. Unverified on-device; see design/notes/Sidebar.md.
        "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
        // #172: nav chrome, not content — see app/globals.css.
        "chrome-touch",
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

          // One Button element in both states — `overflow-hidden` clips
          // `children` visually but keeps it (and its accessible name) in
          // the DOM, instead of swapping icon-only/labelled Buttons.
          return (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              align="left"
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
