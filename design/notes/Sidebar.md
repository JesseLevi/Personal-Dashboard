# Sidebar
Figma: `Sidebar` component set · node `3674:5664` (`Collapsed=No` `3674:5665`, `Collapsed=Yes` `3632:460`; Account `4160:31007`/`4160:32663`) · Code: `components/organisms/Sidebar.tsx`

## Anatomy
- `<nav>` root, `justify-between` (Figma `SPACE_BETWEEN`, #265):
  - a top block (`gap-stack-xxl`) holding the collapse toggle, the Zoeken item and six nav items (`gap-stack-md`);
  - the Account row at the bottom.
- The only variant axis is `Collapsed` → the `collapsed` prop. All state (`collapsed`, `accountMenuOpen`) is composer-owned (`AppShellNav.tsx`).
- Nav items come from a closed `NAV_ITEMS` list: Te doen `Columns3`, Agenda `Calendar` (no Figma node; #486), Notities `Notebook`, Recepten `FolderClosed`, Winkelmand `ShoppingBasket`, Assistent `Astroid` (#226, Kleding removed per ADR-0016).
- **Zoeken** (#581) is a `transparent` Button with `Search` above the modules, outside `NAV_ITEMS`: it is an action, not a route, so it is never active. Props `searchLabel` and `onSearchClick`; `aria-keyshortcuts="Control+K Meta+K"`. It opens `SearchPanel` (`design/notes/SearchPanel.md`), from the mobile drawer too (the drawer closes first).
- The active item is `Button variant="filled"` + `aria-pressed` + `aria-current="page"` (Button's Selected state). Others are `transparent`.
- The Account row is a plain `<button>`, not the Button atom (Figma's frame is not a Button instance). Inside: a 40×40 square `Avatar`, then name + `EllipsisVertical` 16px. It opens a labelless `Dropdown` with Settings (`transparent`) and Logout (`destructive`).
- Labels, `navLabel`, `toggleLabel` and the menu labels are composer-supplied (`components.sidebar.*`).

## Deliberate decisions
- **Explicit widths** `SIDEBAR_EXPANDED_WIDTH = w-[198px]` and `SIDEBAR_COLLAPSED_WIDTH = w-[73px]`. CSS cannot transition `w-fit`. 73 = 16 + 40 + 16 + the 1px border folded in by border-box (measured, #86). `AppShellNav`'s spacer reuses both constants.
- **One Button per item in both states**, with `overflow-hidden whitespace-nowrap`: the label is clipped, not swapped. Swapping elements caused a text jump (#109). Collapsed: 8 padding + 24 icon + 8 gap = 40, so 0px of the label shows.
- **`align="left"` is required on every nav item.** Button's default is centred, which clips the icon in the 40px rail (#108).
- **No `aria-label` on nav items or the account button**: the visible children are the accessible name, even when clipped. A Playwright ARIA snapshot of a doctype-less page reported empty names; Chromium's real AX tree is correct (#109).
- **The collapse transition** uses `transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none`. It must be `duration-[var(...)]`, because `duration-base` compiles to nothing (`--duration-*` is not a Tailwind namespace) (#86).
- **Expanded by default**, unpersisted (`useState(false)` in `AppShellNav`). Figma frames disagree on the default; persisting it is a product call (#88).
- **Desktop**: fixed position plus an `aria-hidden` spacer in the flex row that animates the same widths.
- **Mobile**: the same `Sidebar` (always 198px) in a translate-in drawer over a `bg-overlay/60` scrim. Overlay click, Escape, Tab trap and focus return are reimplemented in `AppShellNav` rather than shared with `SidePanel` (#101). Two `<nav>` instances exist in the DOM; only one is displayed per breakpoint.
- **Outside-click closing of the account menu** lives in `AppShellNav`: one listener checks containment against both wrappers (`lib/dom/outside-pointer.ts`). One listener per wrapper closed the menu before Settings/Logout could fire (#265).
- **Distinct menu ids** `sidebar-account-menu-desktop` and `-mobile`, because both instances can render the panel (#265).
- **The account popover** is positioned by `usePopoverPosition` (`anchor: "left"`, `prefer: "above"`, `w-[209px]`). Its inline `style` (left/top only) is the flagged exception to the no-inline-styles rule. That hook is why the file is `"use client"`.
- **The avatar** is the `Avatar` atom (`size="md"`); the avatar is a rounded square in both states, and the bordered letter fallback lives in `design/notes/Avatar.md` (the border is a user addition on top of Figma). The account hover fill `hover:bg-surface-secondary` is a codebase choice, not Figma-sourced (#265).

## Token gaps and flags
- Motion: `--duration-base` 200ms / `--ease-base` are unsourced (`sidebar-motion-timing-unsourced`).
- Safe-area `pt-/pb-[max(1rem,env(safe-area-inset-*))]` stay raw on top of `p-component-lg` (#113, unverified on a notched device).
- `p-0` on the account button resets native padding (spacing-flag).
- The scrim uses the `overlay` token (stone-950 in both themes). `text-primary` inverted in dark mode (#222).

## Gotchas
- Fill is `bg-surface-primary` on the `<nav>` itself. Never rely on a parent's background: the mobile drawer has none.
- Figma's collapsed active instance carries a stray width of 68 and a "Categorie" label. These are authoring artifacts with no code effect.
- `AppShellNav` has no Ladle story; verify the drawer, scrim and dark mode in the real app.

## Open
- `docs/open-questions.md#sidebar-motion-timing-unsourced`
