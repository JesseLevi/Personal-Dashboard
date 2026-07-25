# Sidebar

- **Code:** `components/organisms/Sidebar.tsx`
- **Node ID:** `3674:5664`

Built #25. Component SET's only variant axis is a single boolean, `Collapsed` (No/Yes) — verified via MCP componentPropertyDefinitions, no other axis exists. Modelled as a plain optional `collapsed` prop with conditional clsx classes (same treatment Atom/Checkbox gives its own Checked=No/Yes axis), not CVA. Six fixed 'Button/Default' nav items (Te doen/Notities/Recepten/Winkelmand/Kleren/Assistent, matching Vision.md's module list 1:1) are rendered from a closed internal list, not a children slot — Figma hardcodes exactly these six, never a variable set. Sizing measured against downloaded node PNGs, not assumed: Collapsed=No is Figma `fixed` 198px (confirmed 396px@2x -> 198px@1x), rendered `w-[198px]` (no spacing/sizing token layer exists yet in this codebase, colours only, so no semantic name to reuse); Collapsed=Yes is Figma `hug`, genuinely different from No's `fixed`, rendered `w-fit` (falls out to the measured 72px = 16 pad + Button's own 40px icon-only footprint + 16 pad, not stated directly). Both variants report Figma `fixed` height 689px, NOT modelled — 689 is far taller than the fetched content needs (~420px), reading as this mockup artboard's own canvas height with no documented viewport constant behind it; rendered `h-full` pending a future App Shell, flagged for re-verification once one exists. Border: the single right-edge 1px stroke is stone-300 -> the existing `border` token (not `surface-raised-hover`, despite sharing the stone-300 primitive — different role, border vs fill, no gap).

## Active item — corrected 2026-07-22 (replaces the earlier FLAGGED GAP/REGRESSION writeup, not appended to it)

The original build read the fetched node's active item (Recepten) as resolving to Button's `Style=Filled, State=Hover` component (stone-300/`surface-raised-hover`) rather than every sibling's own `Style=Filled, State=Default`, and — after cross-variant pixel-sampling seemed to rule out a stray-hover-capture artifact — concluded that was real, deliberate design and shipped a `bg-surface-raised-hover!`/`active:bg-surface-raised-active!` override as a stopgap, flagging `docs/open-questions.md#selected-needs-a-fill-token`.

That conclusion was wrong. It **was** a Figma authoring mistake — the active instance had been set to Button's Hover state instead of its Selected state — and the user has since corrected it in Figma. Re-fetching node `3674:5664` confirms the active item now resolves to `Type=Default, Style=Filled, State=Selected` (componentId `3822:6637`) in both `Collapsed=No` and `Collapsed=Yes`: fill is back to `surface-raised` (stone-200, identical to every sibling and to the toggle button), text darkens to `text` (stone-950, `#0C0A09`). That is exactly `Atom/Button`'s existing Selected state — no override, no new token. `Sidebar.tsx` now renders the active item with `variant="filled"` + `aria-pressed`, dropping the `!` overrides entirely. `docs/open-questions.md#selected-needs-a-fill-token` is resolved (Sidebar was its only evidence); see `docs/incidents.md` for the short correction entry. Icon `Icon/Astroid` (node 3726:2493, Assistant item) maps directly to lucide's own `Astroid` export — an earlier pass wrongly matched it to `Sparkle` by leading numeric coefficients alone (11.017/2.814/1.966) and, on the mistaken belief lucide had no `Astroid` export (a `/asteroid/i` name search missed it — lucide spells it without the middle "e"), briefly vendored the Figma vector as a custom SVG. Rendering both lucide icons side by side against the Figma vector showed lucide's `Astroid` is the real match (same symmetric four-point diamond); `Sparkle` is a visibly different asymmetric twinkle. Fixed to a direct `Astroid` import in Icon.tsx's IconName union. Accessibility: whole component is one `<nav>` landmark (composer-supplied `navLabel`), active item gets `aria-current="page"` (valid on any element, not link-only — these are Button instances, not links, per the fetched node; real href/Link integration is a future composer-level concern, not invented here); toggle is icon-only so its aria-label is a required composer prop (`toggleLabel`, picked per current state, e.g. "Expand sidebar" while collapsed). i18n: navLabel/toggleLabel/labels are all composer-supplied props (same leaf/composer split as CardContainer's addLabel/editLabel), catalog keys under `components.sidebar.*` in messages/{nl,en}.json. Server Component (no "use client"): `collapsed` stays a plain prop, not internal state, since where a real app persists the collapsed flag (cookie/localStorage/URL) genuinely varies by caller, unlike Dropdown's identical-for-every-caller disclosure state.

## Collapse slide transition (#86, 2026-07-22)

Filed as BLOCKED (see `docs/incidents.md`'s prior write-up, still accurate as history): no Figma prototype spec existed, and `w-fit` can't be animated. The user supplied a reference frame (node `3859:6647`, "SidebarAnimation") to unblock it — re-fetching it via MCP confirmed it contains only the same static `Collapsed=No` instance already fetched for this component, with **no** `reactions`/`transitionNodeID`/`transitionDuration`/easing fields anywhere in the payload. Figma still specifies no timing; only the requirement that it *should* slide is real and Figma-sourced (the frame's name and existence), not the how-fast/how-eased part.

- **The real blocker was `w-fit`, not missing polish.** CSS cannot transition `width` to/from an intrinsic-sizing keyword — only between two explicit lengths. Fixed by replacing `w-fit` with a measured, explicit-pixel `SIDEBAR_COLLAPSED_WIDTH` constant, keeping `SIDEBAR_EXPANDED_WIDTH` (the existing `198px`) alongside it for symmetry (both hoisted so the literal Tailwind arbitrary-value string exists in exactly one place each, per the ticket's "token/constant, not a magic number sprinkled around" requirement).
- **The collapsed width is 73px, not the 72px this file previously stated** (`16px pad + Button's 40px icon-only footprint + 16px pad`). That arithmetic was never wrong about the *content*, but it never accounted for Tailwind Preflight's project-wide `box-sizing: border-box`: a real browser's `fit-content` resolution for a border-box element folds the element's own border into the reported box. This `<nav>` carries a `border-r border-border` (1px), so the actual rendered `width`/`offsetWidth` is 73 — confirmed via Playwright against `pnpm ladle`'s dev server (`getBoundingClientRect()` + `getComputedStyle().width`, cross-checked with `clientWidth` = 72, i.e. content minus the 1px border, which matches the old estimate exactly and pinpoints the border as the missing pixel). **The measurement won over the arithmetic hypothesis** — this is the corrected number now, the same "measure the rendered DOM, don't trust the estimate" discipline the #24/#25 incident already established for this project (see `docs/incidents.md`).
- **Motion token layer added** (`design/tokens.json` `semantic.duration.base` / `semantic.easing.base`, synced to `app/theme.css` as `--duration-base: 200ms` / `--ease-base: cubic-bezier(0, 0, 0.2, 1)` via `pnpm sync:tokens`) — the gap this ticket was originally filed to flag. No Figma source exists for either value (confirmed above), so both are this codebase's own default: 200ms, standard ease-out. Flagged at `docs/open-questions.md#sidebar-motion-timing-unsourced` pending a design/product answer, same as any other un-sourced value in this project. `Dropdown.tsx`/`ButtonToggle.tsx` each already reach for Tailwind's raw `duration-200 ease-out` utilities directly (their own doc comments flag the exact same "no project motion token yet" gap) — **not migrated onto the new tokens by this ticket**, since #86 is scoped to Sidebar; a natural follow-up once the pattern is proven here.
- **Stays a Server Component.** The transition is a plain CSS class swap between two explicit-length Tailwind classes (`transition-[width] duration-[var(--duration-base)] ease-base motion-reduce:transition-none` — the duration must use the arbitrary-value form because `--duration-*`, unlike `--ease-*`, is not a Tailwind v4 theme namespace, so a bare `duration-base` compiles to nothing and falls back to the 150ms default) — no measuring, no `ResizeObserver`, so no client JS was needed for the animation itself. `collapsed` remains a composer-supplied prop exactly as before.
- **`prefers-reduced-motion` respected** via `motion-reduce:transition-none`, same precedent `Dropdown`/`Button-toggle` already set.
- **Ladle**: `Sidebar.stories.tsx`'s `Animated` story (unchanged otherwise) now demonstrates a real slide instead of a snap — its doc comment updated to say so; no new story added since this one already exercises the toggle end to end.

## App shell's default collapse state (#88, 2026-07-23)

The three page frames fetched for #88 (Recepten desktop `3672:1577`, Te-Doen
desktop `3680:1442`/`3680:1435`) are **inconsistent about `Collapsed`**: the
Te-Doen desktop frames instance Sidebar as `Collapsed=Yes` (componentId
`3632:460`, `hug`-width ~73px rail), while Recepten desktop and every EmptyState
frame instance it as `Collapsed=No` (`3674:5665`, fixed 198px). Nothing in
either design distinguishes "collapsed is the real Te-Doen default" from
"whoever last touched that frame happened to leave it collapsed" — there's no
prototype connection, annotation, or naming convention pointing either way.

Per the ticket: guessed at neither. `AppShellNav` (`app/(app)/_components/
AppShellNav.tsx`) hardcodes `useState(false)` — **expanded by default** —
and the collapse toggle is purely client-side from there, unpersisted. If a
future ticket needs the collapsed state to survive a reload (cookie/
localStorage/URL, the same three options `Sidebar.tsx`'s own doc comment
already names), that's a product decision to make explicitly, not something
to infer from which page frame happened to be collapsed when it was drawn.

## Desktop `fixed` sidebar + mobile drawer (issue 101, 2026-07-25)

Re-fetched via Figma MCP: `Desktop/Navigation/01`/`02` (3889:17167/17551,
expanded/collapsed), `Mobile/Navigation/01`/`02` (3889:15957/16101, drawer
closed/open). Confirmed against the payload: the mobile closed frame places
`Sidebar` at `x: -198` (off-canvas, `Collapsed=No`, i.e. full 198px width
even on mobile — there is no mobile "collapsed" variant), and the open frame
adds an `Overlay` rectangle (`rgba(12, 10, 9, 0.6)` — the exact same scrim
`SidePanel` already uses via `bg-text/60`) plus the same `Sidebar` instance
at `x: 0`, its own toggle showing `Icon/Panel-left-close`. The desktop frames
confirm `Sidebar` is a `vertical: fill` instance inside a `row`/`stretch`
root — i.e. Figma itself models it as filling the viewport height, which is
what `position: fixed` + `inset-y-0` gives it in code; Figma cannot express
`position: fixed` itself (same "structure yes, CSS mechanism no" gap #102
hit for `position: sticky`).

**Desktop — spacer + fixed, not a flex-row sidebar.** `Sidebar` now renders
`position: fixed; inset-y-0; left-0` (via a wrapping `hidden md:fixed
md:flex` div in `AppShellNav.tsx`) so it stays put while `main` scrolls
vertically. A `fixed` element takes no space in normal flow, so a second,
purely decorative `div` (`aria-hidden`, `shrink-0`) sits in the flex row in
its place, transitioning `width` between the same exported
`SIDEBAR_EXPANDED_WIDTH`/`SIDEBAR_COLLAPSED_WIDTH` constants (now `export`ed
from `Sidebar.tsx` instead of being redeclared) on the same
`--duration-base`/`--ease-base` as the real Sidebar's own collapse
transition, so the two never visibly desync. `main`'s pre-existing `md:pl-32`
is untouched — it is the separate Figma-sourced content inset from the
sidebar's *right edge*, orthogonal to the spacer, which reserves the sidebar's
own width. Fixed sidebar wrapper is `z-30`, below `SidePanel`'s `z-40`/`z-50`
and the mobile drawer below (also `z-40`/`z-50`) — never overlaps either,
confirmed by construction (desktop fixed sidebar only renders `md:` and up;
`SidePanel`/mobile drawer are unrelated subtrees).

**Mobile drawer.** Opened by a new icon-only `Button` (`PanelLeftOpen`)
rendered inside `main`, above `children`, `md:hidden` — the button #88
deliberately left out (its own code comment explained why: announcing a
control that does nothing is worse than no control) now has something to
open, so that comment is gone. Reuses the *same* `Sidebar` component
(`collapsed` left at its default `false`, matching the fetched node's own
always-198px mobile instance) inside a `fixed inset-y-0 left-0` wrapper that
translates in/out (`translate-x-0` / `-translate-x-full`), over an overlay
(`bg-text/60`, `z-40`) — pixel-for-pixel the fetched scrim, already a token
match. Panel wrapper is `z-50`, i.e. the exact same two-layer stack
`SidePanel.tsx` uses for its own overlay/panel.

**Closing.** Per the ticket's own field: overlay-click and Escape are
*"standaardgedrag, niet in Figma gemodelleerd"* — a codebase choice, not a
Figma requirement, flagged here as such. Reused `SidePanel`'s exact
overlay-click/Escape/Tab-trap/`inert`/focus-return shape, but
**reimplemented it locally in `AppShellNav.tsx`** rather than extracting a
shared hook: `SidePanel` is owned by a parallel ticket in this same round
(off-limits per this ticket's scope) and the two closing mechanisms
(`role="dialog"` bottom/side-sheet vs. a full-height nav drawer) don't share
a title contract, so lifting the ~25-line focusable/keydown helper pair into
its own file would be new shared surface for a single caller today — not
worth it yet. If a third consumer needs the same pattern, that's the trigger
to extract it, not this ticket. The in-sidebar toggle itself closes the
drawer (`onToggle` calls `setMobileOpen(false)`, so it renders
`Icon/Panel-left-close` per the fetched open-state node, matching Figma
exactly) in addition to overlay-click/Escape.

**Labels reused, no new i18n keys.** The open button's `aria-label` reuses
`components.sidebar.expandLabel` ("opens the currently-hidden/collapsed
sidebar" reads the same on mobile as on desktop); the drawer's own internal
close toggle reuses `collapseLabel` (closing the full-screen drawer is the
same "put the sidebar away" action `collapseLabel` already names for
desktop, and the ticket explicitly sanctioned reusing `expandLabel` rather
than minting a parallel key, and this follows the same reasoning
symmetrically for the close side). Both `nl.json`/`en.json` are unchanged by
this ticket, key sets already identical.

**Two `Sidebar` instances in the DOM simultaneously.** The desktop
fixed-position wrapper and the mobile-drawer wrapper both render `<Sidebar>`
(hence two `<nav aria-label>` landmarks in the DOM at once), gated
`hidden md:flex` vs. `md:hidden` respectively — exactly the same responsive
duplication `Sidebar`'s own `hidden md:flex` wrapper already used pre-#101
(the mobile side just used to render nothing). Only one is ever `display`ed
at a given viewport width, so only one is ever exposed to the accessibility
tree; verified in a real browser (Playwright MCP) at both 1440px and 402px
that exactly one `<nav>` is visible/focusable at a time, never both, never
neither.

**A repo-infra trap hit for the first time here:**
`scripts/check-server-only.sh`'s raw-hex grep is `(#|%23)[0-9a-fA-F]{3,8}\b`.
Every decimal digit (0-9) is also a valid hex digit, so *any* 3-digit ticket
number (100-999) — not just this one — false-positives as a 3-hex-digit
colour literal. Every prior ticket reference in `components/` was 1-2 digits
and coincidentally immune. Worked around here by writing "issue 101"/"issue
102" instead of "#101"/"#102" in the two `components/` files this ticket
touches (`Sidebar.tsx`, `PageHeader.tsx`) — `app/`-tree files are outside
that grep's scope and keep the ordinary "#101" form. Not fixed at the source
(the script itself is out of this ticket's owned-file list); flagging here
so the next 3-digit-ticket agent doesn't lose time rediscovering it.
