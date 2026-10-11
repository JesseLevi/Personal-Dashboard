# PageHeader
Figma: "Header" frame (plain `FRAME`, not a Component/ComponentSet; duplicated per page design) · node `3878:7959` (Te-Doen desktop, the only one exercising both slots); Recepten `3672:1580`, Te-Doen mobile `3680:1438` · Code: `components/organisms/PageHeader.tsx`

## Anatomy
`<header>`: row, `justify-between`, `items-center`, right padding `pr-page-right-equal`. Left block (`flex items-center gap-inline-lg`) holds the `<h1>` (`text-xl font-semibold text-text-primary`) plus `titleAdornments`; `actions` sits at the far right. Te-Doen fills adornments with icon-only chevron-down (board switcher) and star (favourite) Buttons and actions with a sort Button; Recepten fills only actions with a Plus "Categorie" Button.

## Deliberate decisions
- Built as slots (`titleAdornments`, `actions`), not a fixed button set, because the two pages fill the header with different controls. This generalisation is this codebase's call, not read off one Figma node (#88).
- `title` is caller-supplied data, never a translation key, because on Te-Doen it is the active board's real name (the user can rename it). Recepten is the exception: no board switcher, so its title is a fixed label (`nav.recipes`). Same shape, different source; do not conflate them (#88).
- No row-level gap on `<header>`: `justify-between` spaces the blocks, and Figma's frame has no row gap (#88).
- Sticky (`sticky bg-surface-primary`, no prop, applies to every caller). Figma only states the structure (Header and Carousel are siblings under `Main`, header height fixed at 40); "stays visible on vertical scroll" is this codebase's own read. The opaque background is needed because cards scroll underneath (#102).
- `z-10` on the header. Without it the header painted in "stack level 0" with every `position: relative` sibling, and later DOM order won, so a caller's `z-[999]` dropdown (Winkelmand Sorteer) rendered behind later ingredient rows (swipe-to-delete wrappers are `relative`). Any positive z-index lifts the header and its inner stacking context above those siblings. `z-10` and not higher on purpose: it must stay under `AppShellNav`'s `z-30`/`z-40`/`z-50` layers so the mobile drawer still covers the header (#179).
- `top-[env(safe-area-inset-top)]`, not `top-0` and not a padding idiom: with the iOS PWA `black-translucent` status bar, a stuck header would sit under the clock. `top` only applies once the header is stuck, while padding (as `Sidebar`/`SidePanel` use, since those are permanently at the edge) would add a gap on every unscrolled load. No `max()` needed; `env()` resolves to 0 without an inset. Unverified on real hardware. Audit of all top-of-shell elements: `design/notes/AppShell.md` (#172).
- `chrome-touch` class: header chrome is not reading content, so on coarse pointers it gets no text selection or callout (see `app/globals.css`) (#172).
- Radius/spacing tokens: `gap-inline-lg` read via `boundVariables` on `3878:7959` ("Onderwerp" child `itemSpacing` = `spacing/inline/gap-lg`). Right padding uses the page-padding token `pr-page-right-equal` (16 mobile / 128 desktop) per the ticket's page-padding rule (#205).

## Token gaps and flags
- The root frame's own `itemSpacing` and `paddingRight` (128px) are unbound in the node; the page-padding tokens supersede them (#205).

## Gotchas
- Adornment and action buttons are inert apart from what each page wires: the chevron and star have only an aria-label, no board-switch or favourite persistence in this component. Category creation is wired by the page (#28).
- A page-level dropdown inside the header must rely on this component's `z-10` stacking context; do not add a lower z-index to the header or move dropdowns out expecting them to beat siblings.
- Both stories (`page-header--te-doen`, `page-header--recepten`) are visual baselines; the header's background change regenerates them together.
- Horizontal-scroll containment of the board half of the sticky work: `design/notes/TeDoenBoard.md` and `Carousel.md`.
