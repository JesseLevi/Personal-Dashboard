# MobileTabBar
No Figma node: Claude-designed on request (ADR-0034, ADR-0055) · Code: `components/organisms/MobileTabBar.tsx`, used by `app/(app)/_components/AppShellNav.tsx` · Story: `basis--panelen--mobile-tab-bar--overview`

## Anatomy
`<nav>` fixed to the bottom below `md` (`md:hidden`), `z-30` (under the drawer scrim `z-40` and every `SidePanel`/sheet `z-50`). One equal-width `button` per module: 22px `Icon` over a `text-xs` semibold label; `aria-current="page"` on the active one.

## Deliberate decisions
- Items are the Sidebar's `NAV_ITEMS` that have a route (`ROUTES` in `AppShellNav`), so the two navigations never drift. Labels are the Sidebar's, except where `sidebar.tabItems.<id>` gives a shorter one ("Mand" for Winkelmand) so nothing truncates at 375/390px.
- Below 360px the labels become `sr-only` (icons only): five or six labels do not fit at 320px.
- Active = `text-text-primary`, rest `text-text-secondary`, the same contrast step the Sidebar uses; no pill or fill, so no new token.
- Surface `bg-surface-highlight-white` with a `border-stroke-primary` top rule, as `SidePanel`'s mobile footer.
- The drawer (hamburger) stays for account, settings and search; the tab bar only switches modules.
- Hidden on the note editor (`/notities/<id>`): `EditingBar` owns the bottom edge there, and the keyboard would lift both.

## Token gaps and flags
- `spacing-flag`: `h-[env(safe-area-inset-bottom)]` spacer at the end of `main` (AppShellNav): `pb-page-bottom` (80px) clears the 56px bar, but not the bar's own safe-area padding on a notched iPhone.
- `h-14` (56px) is a sizing utility, not spacing.

## Gotchas
- Not checked on a device: safe-area padding in standalone mode, and that no page's last row hides under the bar.
