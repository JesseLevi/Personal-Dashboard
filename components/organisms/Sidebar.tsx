"use client";

// figma: node-id=3674:5664
import { cn } from "@/lib/ui/cn";
import { useRef } from "react";
import { Button } from "../atoms/Button";
import { Dropdown } from "../atoms/Dropdown";
import { Icon, type IconName } from "../atoms/Icon";
import { usePopoverPosition } from "../../lib/dom/use-popover-position";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664).
 * Variant axis: `Collapsed` (No/Yes) -> `collapsed` prop. Five modules ->
 * fixed `NAV_ITEMS` list. Active item -> Button's `Style=Filled,
 * State=Selected`. `bg-surface-primary` is Figma's fill; nav-item Buttons
 * render one element across both states (`overflow-hidden` clips the
 * label as the rail shrinks). #265 added the bottom account row (node
 * `4160:31007`/`4160:32663`) — root layout is now `justify-between`
 * (Figma's own `primaryAxisAlignItems`), not a flat fixed gap. `"use
 * client"` since 2026-08-18: the account dropdown now measures its own
 * placement via `usePopoverPosition`, which needs hooks even though
 * `accountMenuOpen` itself stays composer-owned — see
 * docs/incidents.md. Full rationale + measurements: design/notes/Sidebar.md.
 */
export type SidebarItemId =
  | "todo"
  | "notes"
  | "recipes"
  | "shopping"
  | "assistant";

const NAV_ITEMS: ReadonlyArray<{ id: SidebarItemId; icon: IconName }> = [
  { id: "todo", icon: "Columns3" },
  { id: "notes", icon: "Notebook" },
  { id: "recipes", icon: "FolderClosed" },
  { id: "shopping", icon: "ShoppingBasket" },
  { id: "assistant", icon: "Astroid" },
];

// Explicit-px, not `w-fit` — CSS can't transition to/from an intrinsic
// keyword. 73px (not 72) accounts for border-box folding the 1px border;
// see design/notes/Sidebar.md. Exported so AppShellNav's spacer reuses them.
export const SIDEBAR_EXPANDED_WIDTH = "w-[198px]";
export const SIDEBAR_COLLAPSED_WIDTH = "w-[73px]";

// First letter of the first two words — not Figma-sourced (no initials
// treatment in the fetched node). See design/notes/Sidebar.md.
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

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
  /** #170: fired on `pointerenter`/`focus` — composer's hook for
   * `router.prefetch(href)` ahead of the click, not a Figma-driven prop. */
  onItemHover?: (item: SidebarItemId) => void;
  /** #265: the signed-in user's display name (composer resolves the null-`display_name` fallback, e.g. `components.sidebar.accountFallbackName`). */
  accountName: string;
  /** #265: public avatar URL, when set. Renders an initials fallback when null/undefined — no upload UI exists yet (out of scope), so this stays null until a future ticket adds one. */
  accountAvatarUrl?: string | null;
  /** #265: whether the account dropdown (Settings/Logout) is open. Composer-owned — the row itself is stateless, same split as `onToggle`/`collapsed`. */
  accountMenuOpen: boolean;
  /** #265: id pair wiring the trigger to its dropdown panel (`aria-controls` / the panel's own `id`). */
  accountMenuId: string;
  /** #265: fired when the account row itself is clicked. */
  onAccountMenuToggle?: () => void;
  /** #265: Settings dropdown item text + handler (Transparent, per Figma). */
  settingsLabel: string;
  onSettingsClick?: () => void;
  /** #265: Logout dropdown item text + handler (Destructive, per Figma). */
  logoutLabel: string;
  onLogoutClick?: () => void;
  className?: string;
}

// `collapsed`/`accountMenuOpen` stay plain composer-owned props (AppShellNav),
// same reasoning as Atom/Checkbox's `checked` — importing `Dropdown` doesn't
// require owning that state here. Only the account popover's own on-screen
// position is local, via `usePopoverPosition` below.
export function Sidebar({
  collapsed = false,
  navLabel,
  toggleLabel,
  onToggle,
  activeItem,
  labels,
  onNavigate,
  onItemHover,
  accountName,
  accountAvatarUrl,
  accountMenuOpen,
  accountMenuId,
  onAccountMenuToggle,
  settingsLabel,
  onSettingsClick,
  logoutLabel,
  onLogoutClick,
  className,
}: SidebarProps) {
  const accountRef = useRef<HTMLDivElement>(null);
  const accountPopoverRef = useRef<HTMLDivElement>(null);
  // Opens upward by design (bottom-full) — docs/incidents.md, 2026-08-18.
  const accountPopover = usePopoverPosition(accountRef, accountPopoverRef, {
    open: accountMenuOpen,
    anchor: "left",
    prefer: "above",
  });

  return (
    <nav
      aria-label={navLabel}
      className={cn(
        // GAP: duration unsourced, docs/open-questions.md#sidebar-motion-timing-unsourced.
        // justify-between (#265): Figma root is now SPACE_BETWEEN, not a
        // flat gap — see design/notes/Sidebar.md.
        "flex h-full flex-col items-end justify-between border-r border-stroke-primary bg-surface-primary p-component-lg transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none",
        // pt-/pb- (#113): safe-area padding, no-op without a notch/inset. See design/notes/Sidebar.md.
        "pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
        // #172: nav chrome, not content — see app/globals.css.
        "chrome-touch",
        collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        className,
      )}
    >
      {/* Figma "Icon + items" (4160:30312) — see design/notes/Sidebar.md. */}
      <div className="flex w-full flex-col items-end gap-stack-xxl">
        <Button
          variant="filled"
          icon={collapsed ? "PanelLeftOpen" : "PanelLeftClose"}
          aria-label={toggleLabel}
          onClick={onToggle}
        />
        <div className="flex w-full flex-col gap-stack-md">
          {NAV_ITEMS.map(({ id, icon }) => {
            const isActive = id === activeItem;
            const variant = isActive ? "filled" : "transparent";
            const label = labels[id];
            const handleClick = onNavigate ? () => onNavigate(id) : undefined;
            const handleHover = onItemHover ? () => onItemHover(id) : undefined;

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
                onPointerEnter={handleHover}
                onFocus={handleHover}
                className="overflow-hidden whitespace-nowrap"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Figma "Account" (4160:31007/4160:32663) — see design/notes/Sidebar.md. */}
      <div ref={accountRef} className="relative w-full">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          aria-controls={accountMenuId}
          onClick={onAccountMenuToggle}
          // No aria-label (visible name supplies it, same NAV_ITEMS lesson).
          // Hover fill is a codebase decision, not Figma-sampled.
          // spacing-flag: p-0 resets native UA button padding, not Figma-sourced. design/notes/Sidebar.md.
          className="chrome-touch flex w-full items-center gap-inline-sm overflow-hidden rounded-control p-0 text-left transition-colors hover:bg-surface-secondary"
        >
          {accountAvatarUrl ? (
            <img
              src={accountAvatarUrl}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 rounded-control-inner object-cover"
            />
          ) : (
            // Exact unbound match for surface-secondary-hover — design/notes/Sidebar.md.
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-control-inner bg-surface-secondary-hover text-xs font-semibold text-text-secondary"
            >
              {initialsFor(accountName)}
            </span>
          )}
          {/* Figma "Name + icon" (4160:31009): hug-width, zero internal gap — design/notes/Sidebar.md. */}
          <span className="inline-flex shrink-0 items-center">
            <span className="whitespace-nowrap text-xs font-semibold text-text-primary">
              {accountName}
            </span>
            <Icon name="EllipsisVertical" size={16} className="text-text-secondary" />
          </span>
        </button>

        {accountMenuOpen ? (
          // Opens upward, left-anchored — measured, see design/notes/Sidebar.md.
          // Same z-[999] shape as TeDoenHeader.tsx's dropdowns. The inline
          // `style` is a deliberate, flagged deviation from CLAUDE.md's
          // no-inline-styles-in-components/ rule: it carries left/top only,
          // computed at runtime by usePopoverPosition. A viewport-clamped
          // position is not expressible as a token or a utility — it depends
          // on where the trigger actually lands. See design/notes/Sidebar.md.
          <div
            ref={accountPopoverRef}
            id={accountMenuId}
            className="absolute z-[999] w-[209px]"
            style={accountPopover.style}
          >
            <Dropdown className="shadow-sm">
              <Button variant="transparent" icon="Settings" align="left" onClick={onSettingsClick}>
                {settingsLabel}
              </Button>
              <Button variant="destructive" icon="LogOut" align="left" onClick={onLogoutClick}>
                {logoutLabel}
              </Button>
            </Dropdown>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
