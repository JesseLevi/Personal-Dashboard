// figma: node-id=3674:5664
import clsx from "clsx";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664). The
 * app's persistent left-hand module navigation: an icon-only collapse toggle
 * above a fixed stack of six module links (Vision.md §3). Full rationale,
 * measurements, and ticket history: `design/notes/Sidebar.md`.
 *
 * Non-obvious constraints a future edit must not break:
 * - `collapsed` is a plain prop, not CVA and not owned state — this is a
 *   Server Component; where the flag lives (cookie/localStorage/URL) varies
 *   by caller, same reasoning as `Atom/Checkbox`'s `checked`.
 * - The six items come from the internal `NAV_ITEMS` list, not a `children`
 *   slot — Figma hardcodes exactly these six, never a variable set.
 * - `SIDEBAR_EXPANDED_WIDTH`/`SIDEBAR_COLLAPSED_WIDTH` are measured pixels
 *   (198/73), not tokens — there is no sizing token layer yet. 73, not the
 *   72 padding-plus-icon arithmetic would suggest, because Preflight's
 *   `box-sizing: border-box` folds this `<nav>`'s own 1px border into
 *   `fit-content`'s resolved box.
 * - The transition's duration MUST use the arbitrary-value form,
 *   `duration-[var(--duration-base)]` — unlike `--ease-*`, `--duration-*` is
 *   not a real Tailwind v4 theme namespace, so a bare `duration-base` class
 *   compiles to nothing and silently falls back to the 150ms default.
 * - Active item = `Atom/Button`'s own `Style=Filled, State=Selected`
 *   (`variant="filled"` + `aria-pressed`) — no colour override, no new token.
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

// Both Collapsed endpoints as named, explicit-pixel constants (ticket #86) —
// hoisted so the value exists in exactly one place, rather than the literal
// Tailwind arbitrary-value class being written out at each of the two call
// sites below. See this file's own doc comment ("Sizing" / "Motion") for how
// each number was measured. `SIDEBAR_COLLAPSED_WIDTH` replaces the former
// `w-fit`: CSS cannot transition `width` to/from an intrinsic-sizing keyword,
// only between two literal lengths, which these two constants now are.
const SIDEBAR_EXPANDED_WIDTH = "w-[198px]";
const SIDEBAR_COLLAPSED_WIDTH = "w-[73px]";

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
        "flex h-full flex-col items-end gap-12 border-r border-border p-4 transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
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

          return collapsed ? (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              aria-pressed={isActive || undefined}
              onClick={handleClick}
            />
          ) : (
            <Button
              key={id}
              variant={variant}
              icon={icon}
              aria-current={isActive ? "page" : undefined}
              aria-pressed={isActive || undefined}
              onClick={handleClick}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
