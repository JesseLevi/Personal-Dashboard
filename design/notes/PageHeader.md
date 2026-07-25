# PageHeader

- **Code:** `components/organisms/PageHeader.tsx`
- **Node ID:** `3878:7959` (Te-Doen desktop "Header" frame — chosen as the
  canonical reference because it's the only one of the three fetched Header
  frames that exercises both slots; Recepten's is `3672:1580`, Te-Doen
  mobile's is `3680:1438`)

Built #88. Not a Figma Component/ComponentSet — every fetched "Header" is a
plain `FRAME`, duplicated per page design rather than instanced from a shared
component. The ticket asked for it to be built as slots (`titleAdornments`,
`actions`) rather than a fixed button set, since the two page designs fill it
with different controls; that generalisation is this ticket's own call, not
something read directly off a single Figma node — flagged here per
`docs/guides/ui-components.md`'s "never build what isn't in Figma" since it's
the one place this ticket deviates from a literal 1:1 read.

## Structure (fetched via MCP, all three nodes)

All three Header frames share: `row`, `justifyContent: space-between`,
`alignItems: center` (Recepten's frame omits an explicit `alignItems` but
renders visually identical — its children are a `hug`-sized title and a
40px-tall button, same as the others), sizing `fill`/`hug`. Right padding is
the "pull the header content in from the Carousel's edge-to-edge cards"
padding — `128px` desktop, `16px` mobile — see the shell padding measurements
in `docs/HANDOFF.md`'s #88 entry and the PR report.

- **Title container** ("Onderwerp" in Te-Doen's node, unnamed in Recepten's):
  `row`, `alignItems: center`, `gap: 16px` → `flex items-center gap-4`. Holds
  the `<h1>` plus `titleAdornments`.
- **Title text**: `text-xl/semibold`, fill `#0C0A09` → `text-xl font-semibold
  text-text` per the ticket, confirmed directly against the fetched
  `textStyle`/`fills` on all three title nodes.
- **Title adornments** (Te-Doen only): two icon-only `Button/Default`
  instances, `Icon/Chevron-down` (board switcher) and `Icon/Star`
  (favourite), both `With text: false` → Button's default icon-only 40×40
  box. Neither Chevron nor Star wires to real behaviour yet (no board-switch
  UI, no favourite persistence) — both are inert buttons with an aria-label,
  same "not invented here" scope-limit as Sidebar's nav buttons before real
  routing existed.
- **Actions**: Te-Doen's is `Icon/Arrow-up-down` + text "Sorteer " (`Button
  variant="filled" icon="ArrowUpDown"`, no sort logic wired — out of scope);
  Recepten's is `Icon/Plus` + text "Categorie " (`Button icon="Plus"`, no
  category-creation flow wired — out of scope, #28).

## `title` is data, not chrome — except once

Per the ticket: on Te-Doen, `title` is the *active board's real name* — "Te
doen" is just the seeded default board, not a fixed label, so it must never
be an i18n key (that would fight the user's own board rename). The stub route
(`app/(app)/te-doen/page.tsx`) hardcodes the literal `"Te doen"` — matching
`seed_default_board()`'s literal seed value exactly — as a placeholder until
board-fetching lands (#90 BoardView / #92). It stays the same word in every
locale on purpose, since board names are user data and were never meant to
localise.

Recepten is the deliberate exception: it has no board switcher, so its title
*is* a fixed page label, not board data — `nav.recipes` in
`messages/{nl,en}.json`, actually translated. Two different sources landing
on the same design shape (a `<h1>` in the same slot) is exactly why the
ticket called this out: don't let the two conflate just because they render
identically.

## i18n

New keys, both catalogs, identical key sets: `nav.recipes` (Recepten's
translated title) and `components.pageHeader.{todo.boardSwitcherLabel,
todo.favoriteLabel, todo.sortLabel, recipes.addCategoryLabel}` (the four
button labels above — three aria-labels, one visible button text). Sidebar's
own `components.sidebar.items.*` are reused as-is by the app shell, not
duplicated here.

## Not built (deliberately)

- Sort behaviour, board switching, favourite persistence, category creation —
  all just render an inert button with the right label; the ticket's scope is
  shell + header slots, not the actions themselves.
- A wrapping `gap` between the title block and `actions` was deliberately
  left off `<header>` (only the title block has its own `gap-4`) —
  `justify-between` already spaces them, and Figma's own Header frame has no
  row-level gap.

## Ladle

`PageHeader.stories.tsx`: `TeDoen` (title adornments + sort action) and
`Recepten` (category action only) — the two shapes the ticket asked the story
to cover.

## Sticky header (issue 102, 2026-07-25)

Re-fetched via Figma MCP (`3680:1442` board frame, depth 2): `Main` is
`Header` and `Carousel` as **siblings**, both direct children of `Main`'s own
column — Header is `sizing: {horizontal: fill, vertical: fixed}` height 40,
Carousel is a separate `fill`/`hug` row below it. That sibling split (Header
never wraps Carousel, and vice versa) is the actual, verifiable Figma
requirement; `position: sticky` itself is not something Figma nodes can
encode (no `position`/`sticky` field exists in the payload for any node,
same "Figma states structure, not the CSS mechanism" gap `Sidebar.md`'s
`position: fixed` entry also hit) — applying it is this codebase's own read
of "blijft zichtbaar bij verticaal scrollen," not a literal Figma property.

**Applied to `<header>` itself, unconditionally** — `sticky top-0
bg-surface-muted`, no new prop. This affects every caller (Te-Doen, Recepten,
both stories) identically; no opt-out was added since the ticket's ask
("maak de volledige header sticky") has no stated exception and a sticky
header with nothing to scroll past (Recepten's current stub) is simply inert,
not broken. `bg-surface-muted` matches the token `main` itself already uses
(`AppShellNav.tsx`) — needed because cards scroll *underneath* the sticky box
and would otherwise show through a transparent header.

**No explicit `z-index`.** `position: sticky` with `z-index: auto` does not
establish a new stacking context, so `TeDoenHeader.tsx`'s `z-[999]`
board-switcher/sort dropdown panels (its own file, not touched here) are
never capped by anything this component sets. The header still paints above
the (non-positioned, `position: static`) scrolling cards below it purely
because it's a *positioned* element (sticky counts) among unpositioned
siblings — verified in a real browser (Playwright MCP, 1440px + 402px) by
scrolling a populated board under the header and confirming the header
opaquely occludes the cards with no z-index set at all, and separately that
an open board-switcher/sort dropdown still renders above the scrolling board
after this change. See `design/notes/TeDoenBoard.md`/`Carousel.md` for the
horizontal-scroll-containment half of this same ticket.

**Visual baseline:** both `PageHeader` stories regenerate (`bg-surface-muted`
replaces what used to be a transparent header showing the Ladle Provider's
own `bg-surface` through it) — `page-header--te-doen` and
`page-header--recepten`, scoped-regenerated together, not the full suite.
