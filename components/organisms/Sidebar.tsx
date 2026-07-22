// figma: node-id=3674:5664
import clsx from "clsx";
import { Button } from "../atoms/Button";
import type { IconName } from "../atoms/Icon";

/**
 * Organism/Sidebar — Figma component set "Sidebar" (node-id 3674:5664,
 * Organisms section). The app's persistent left-hand module navigation: an
 * icon-only expand/collapse toggle above a fixed stack of six module links,
 * one per Vision.md §3 module currently in scope (Kanban → "Te doen",
 * Notities, Recepten, Winkelmand → Boodschappenlijst, Kleren → Kleding, the
 * AI-agent → "Assistent").
 *
 * Figma variant axis (verified via MCP per the ticket's own instruction —
 * `componentPropertyDefinitions` on 3674:5664 was read, not assumed): a
 * single boolean, `Collapsed` (`No`/`Yes`), and nothing else — no other
 * property axis exists on this set. Modelled as a plain optional `collapsed`
 * prop with conditional `clsx` classes, the same treatment `Atom/Checkbox`
 * already gives its own Figma `Checked=No/Yes` axis, rather than introducing
 * a CVA boolean variant (an untested pattern in this codebase — every
 * existing CVA use here models a multi-value Style/Size string, not a
 * Yes/No axis).
 *
 * Figma structure, mirrored 1:1 (organism → atoms only, dependencies flow
 * one way per CLAUDE.md):
 *   root `<nav>` (column, p-4, gap-12, items-end, border-r border-border)
 *   ├─ INSTANCE "Button/Default" (icon-only, `variant="filled"`) — the
 *   │  toggle. Icon swaps Panel-left-close (expanded) ↔ Panel-left-open
 *   │  (collapsed); it is the *same* Button style both states, only the
 *   │  icon prop differs.
 *   └─ "Item container" (column, fill width, gap-3) — six fixed
 *      "Button/Default" instances. NOT a generic `children` slot: Figma
 *      hardcodes exactly these six items (same six every time, matching
 *      Vision.md's module list one-to-one), so they are rendered from a
 *      closed, internal `NAV_ITEMS` list rather than composer-supplied
 *      children — the composer only supplies labels/active-state/handlers
 *      for this fixed set, the same "don't invent a slot Figma doesn't
 *      define" reasoning `CardContainer` already used for its own fixed
 *      Croissant icon and edit buttons (there for chrome that can't vary;
 *      here for a list whose membership can't vary). Each item is Icon +
 *      optional Text — Text visibility tracks `collapsed` for every item at
 *      once (Figma's own `With text` boolean is flipped set-wide between the
 *      two Collapsed components, never per item), so `collapsed` alone
 *      decides the icon-only vs. labelled Button branch below.
 *
 * Sizing (measured against the downloaded node PNGs, not assumed —
 * `sidebar-collapsed-no.png` / `sidebar-collapsed-yes.png`, both @2x):
 * - Collapsed=No: Figma states `sizing.horizontal: fixed`, 198px; the PNG
 *   (396×1378 @2x) confirms 198px @1x. Rendered via the `SIDEBAR_EXPANDED_WIDTH`
 *   constant (`w-[198px]`) — a literal measured pixel, not a rounding
 *   shortcut: Tailwind's default width scale has no step at 198, and this
 *   codebase has no spacing/sizing token layer yet (only colours and, as of
 *   #86, motion are tokenized per ADR-0010), so there is no semantic name to
 *   reuse here the way colour gaps get one.
 * - Collapsed=Yes: Figma states `sizing.horizontal: hug` — genuinely
 *   different from No's `fixed`, not a copy/paste artifact. Originally
 *   rendered `w-fit`, which the doc comment estimated at 72px (16px pad +
 *   `Atom/Button`'s own 40px icon-only footprint + 16px pad) without
 *   measuring the real box. Ticket #86 needed an explicit length (CSS cannot
 *   transition `width` to/from the intrinsic-sizing keyword `fit-content`
 *   `w-fit` compiles to — only between two literal lengths), so the estimate
 *   was checked against the real rendered DOM instead of trusted: Playwright
 *   against `pnpm ladle`'s dev server, reading `getBoundingClientRect()` /
 *   `getComputedStyle().width` on the collapsed `<nav>`. The measured value is
 *   **73px, not 72** — Tailwind's Preflight sets `box-sizing: border-box`
 *   project-wide, so the browser's `fit-content` resolution folds this
 *   element's own `border-r border-border` (1px) into the box it reports,
 *   which the padding-plus-icon arithmetic alone didn't account for
 *   (`clientWidth` — content minus border — is exactly 72, confirming the
 *   extra pixel is the border, not a measurement error). Rendered via the
 *   `SIDEBAR_COLLAPSED_WIDTH` constant (`w-[73px]`) — the measured DOM value
 *   wins over the arithmetic estimate.
 * - Height: both variants report Figma `sizing.vertical: fixed`, 689px —
 *   NOT modelled literally. 689 is far taller than the fetched content
 *   needs (16 pad + 40 toggle + 48 gap + [6×40 items + 5×12 gaps] + 16 pad
 *   ≈ 420px), reading as this specific mockup artboard's own canvas height
 *   rather than a deliberate design constant — no viewport height is
 *   documented anywhere in Architecture.md/Vision.md that 689 could tie to.
 *   Rendered `h-full` so a future layout organism (no App Shell exists yet)
 *   controls the real height — the same "no real parent yet" reasoning
 *   `CardContainer`'s doc comment already used for its own (there
 *   `contextual`, here literally `fixed`) sizing. Flagged for
 *   re-verification once an App Shell is built.
 *
 * Colour: the single stroke (`0px 1px 0px 0px`, right edge only) is
 * stone-300 → the existing `border` token, not `surface-raised-hover` even
 * though both share the stone-300 primitive — different semantic role
 * (border vs. fill), so no gap. No other token is touched directly by this
 * file: every nav item's fill/text colour comes from composing `Atom/Button`
 * unchanged (`variant="filled"`/`variant="transparent"`), which already
 * reads its own tokens.
 *
 * Active item, corrected 2026-07-22: the fetched node's active instance
 * (Recepten) was originally authored on Button's `State=Hover` component by
 * mistake (stone-300 fill) — a genuine Figma authoring error, not deliberate
 * design as an earlier revision of this file concluded from cross-variant
 * pixel-sampling. The user fixed the Figma instance to the real `Style=
 * Filled, State=Selected` component (componentId 3822:6637, re-verified via
 * MCP) and the fill is back to `surface-raised` — identical to every
 * sibling's Default fill and to the toggle button's own fill — with only the
 * text darkened to `text` (stone-950 in the fetched node). That is
 * exactly `Atom/Button`'s existing Selected state (`aria-pressed:text-text`,
 * see `docs/design-tokens.md` §Selected), so no override or new token is
 * needed: the active item sets `variant="filled"` plus `aria-pressed`
 * alongside its existing `aria-current="page"`, and Selected composes with
 * Hover/Active by construction (disjoint CSS properties — see Button.tsx's
 * own doc comment). See `docs/incidents.md` for the short correction entry
 * and `design/notes/Sidebar.md` for the retired FLAGGED GAP writeup this
 * replaces.
 *
 * Icons: `Panel-left-close`/`Panel-left-open` and the five listed module
 * icons were already shape-verified by earlier tickets (see `Icon.tsx`'s own
 * header). One new mapping was needed for this ticket — `Icon/Astroid` (node
 * 3726:2493, the Assistant item) maps directly to lucide's own `Astroid`
 * export, confirmed by rendering both side by side (an earlier pass had
 * wrongly matched it to `Sparkle` by numeric coincidence — see `Icon.tsx`'s
 * header for the full correction, search "ticket #25").
 *
 * Accessibility: the whole component is a `<nav>` landmark with a
 * composer-supplied accessible name (`navLabel`) — a "region" is exactly
 * what this is (the six module links plus their own collapse toggle), so it
 * is not split into an outer `<aside>` wrapping an inner `<nav>`. The active
 * item carries `aria-current="page"` (valid on any element per the ARIA
 * spec, not link-only — these are `<button>`s, not `<a>`s, since the fetched
 * node nests plain `Button/Default` instances, never link instances; real
 * `href`/`Link` integration is a future, composer-level concern this file
 * does not invent). The toggle is icon-only, so its accessible name is a
 * required prop the composer must pick per current state (`toggleLabel` —
 * e.g. "Expand sidebar" while collapsed, "Collapse sidebar" while expanded),
 * the same discriminated-union requirement `Atom/Button` itself already
 * enforces for any icon-only instance.
 *
 * i18n: every user-facing string (the six item `labels`, `navLabel`,
 * `toggleLabel`) is a required composer prop, never imported from
 * next-intl in this file — the same leaf/composer split `CardContainer`'s
 * `addLabel`/`editLabel` already established. Catalog keys live under
 * `components.sidebar.*` in `messages/{nl,en}.json`.
 *
 * Motion (ticket #86): the collapse toggle previously snapped instantly
 * between widths because `w-fit` (an intrinsic-sizing keyword) cannot be
 * animated — CSS only transitions `width` between two explicit lengths, never
 * to/from `fit-content`/`auto`/`max-content`. Re-fetching the user-supplied
 * animation reference frame (node `3859:6647`, "SidebarAnimation") confirmed
 * there is still no machine-readable timing anywhere: the MCP payload carries
 * no prototype `reactions`/`transitionNodeID`/`transitionDuration`/easing
 * fields, only the same static `Collapsed=No` instance already fetched for
 * this component. So the *fact* that it should slide is this ticket's own
 * explicit requirement, same as `Atom/Button-toggle`'s indicator motion;
 * `duration-base`/`ease-base` (200ms, standard ease-out — see
 * `design/tokens.json`'s `semantic.duration`/`semantic.easing` `$comment`s)
 * are this codebase's own default, not Figma-sourced, flagged at
 * `docs/open-questions.md#sidebar-motion-timing-unsourced`. Unlike
 * `Dropdown`/`Button-toggle`, which each reach for Tailwind's raw
 * `duration-200 ease-out` directly (their own doc comments flag the same
 * "no project motion token" gap this ticket closes), this is the first
 * consumer of the new *named* semantic tokens — a class-swap CSS transition
 * on the `transition-[width]` property, no JS measuring required now that
 * both endpoints (`SIDEBAR_EXPANDED_WIDTH`/`SIDEBAR_COLLAPSED_WIDTH` below)
 * are explicit pixel lengths, so this stays a plain server-rendered class
 * toggle — no `"use client"` needed for the animation itself (see the Server
 * Component note below for `collapsed` itself). `motion-reduce:transition-none`
 * disables it for `prefers-reduced-motion` users, the same precedent
 * `Dropdown`/`Button-toggle` already set.
 *
 * Server Component (no `"use client"`): `collapsed` is a plain prop, not
 * component-owned state, because — unlike `Atom/Dropdown`'s disclosure,
 * which is identical ephemeral UI state for every caller and so stays
 * self-owned — *where* a sidebar's collapsed flag lives genuinely varies by
 * caller (a cookie for SSR-stable layout, `localStorage`, URL state, etc.),
 * so the composing layout, not this leaf, must own it. Same reasoning
 * `Atom/Checkbox` already gives for staying a Server Component with a
 * composer-owned `checked`. The #86 width transition doesn't change this: a
 * CSS class swap on a still-server-rendered prop needs no client JS.
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
        "flex h-full flex-col items-end gap-12 border-r border-border p-4 transition-[width] duration-base ease-base motion-reduce:transition-none",
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
