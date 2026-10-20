# PageHeader
Figma: "Header" frame (plain `FRAME`, not a Component/ComponentSet; duplicated per page design) · node `3878:7959` (Te-Doen desktop, the only one exercising both slots); Recepten `3672:1580`, Te-Doen mobile `3680:1438` · Code: `components/organisms/PageHeader.tsx`

## Anatomy
`<header>`: row, `justify-between`, `items-center`, right padding `pr-page-right-equal`. Left block (`flex items-center gap-inline-lg`) holds the `<h1>` (`text-xl font-semibold text-text-primary`, rendered by the client piece `PageHeaderTitle.tsx`) plus `titleAdornments`; `actions` sits at the far right. Te-Doen fills adornments with icon-only chevron-down (board switcher) and star (favourite) Buttons and actions with a sort Button; Recepten fills only actions with a Plus "Categorie" Button.

## Deliberate decisions
- Built as slots (`titleAdornments`, `actions`), not a fixed button set, because the two pages fill the header with different controls. This generalisation is this codebase's call, not read off one Figma node (#88).
- `title` is caller-supplied data, never a translation key, because on Te-Doen it is the active board's real name (the user can rename it). Recepten is the exception: no board switcher, so its title is a fixed label (`nav.recipes`). Same shape, different source; do not conflate them (#88).
- No row-level gap on `<header>`: `justify-between` spaces the blocks, and Figma's frame has no row gap (#88).
- Sticky (`sticky bg-surface-primary`, no prop, applies to every caller). Figma only states the structure (Header and Carousel are siblings under `Main`, header height fixed at 40); "stays visible on vertical scroll" is this codebase's own read. The opaque background is needed because cards scroll underneath (#102).
- `z-10` on the header. Without it the header painted in "stack level 0" with every `position: relative` sibling, and later DOM order won, so a caller's `z-[999]` dropdown (Winkelmand Sorteer) rendered behind later ingredient rows (swipe-to-delete wrappers are `relative`). Any positive z-index lifts the header and its inner stacking context above those siblings. `z-10` and not higher on purpose: it must stay under `AppShellNav`'s `z-30`/`z-40`/`z-50` layers so the mobile drawer still covers the header (#179).
- `top-[env(safe-area-inset-top)]`, not `top-0` and not a padding idiom: with the iOS PWA `black-translucent` status bar, a stuck header would sit under the clock. `top` only applies once the header is stuck, while padding (as `Sidebar`/`SidePanel` use, since those are permanently at the edge) would add a gap on every unscrolled load. No `max()` needed; `env()` resolves to 0 without an inset. Unverified on real hardware. Audit of all top-of-shell elements: `design/notes/AppShell.md` (#172).
- Safe-area strip (#552): a `before:` pseudo-element, `fixed inset-x-0 top-0`, `h-[env(safe-area-inset-top)]`, `bg-surface-primary`, `pointer-events-none`, covers the status-bar area over the full viewport width so scrolled content no longer shows above the stuck header. Zero height without an inset (desktop, browsers). Layout is unaffected (fixed, out of flow). Unverified on real hardware.
- `chrome-touch` class: header chrome is not reading content, so on coarse pointers it gets no text selection or callout (see `app/globals.css`) (#172).
- Radius/spacing tokens: `gap-inline-lg` read via `boundVariables` on `3878:7959` ("Onderwerp" child `itemSpacing` = `spacing/inline/gap-lg`). Right padding uses the page-padding token `pr-page-right-equal` (16 mobile / 128 desktop) per the ticket's page-padding rule (#205).

## Title as a button
`titleTrigger` (`PageHeaderTitleTrigger`: `onClick`, `expanded`, `buttonRef`) wraps the title text in a `<button>` inside the `<h1>` (`aria-haspopup="dialog"`, `aria-expanded`) and adds a `ChevronDown` after the text. The chevron sits inside the morphing text span, so it is part of the measured width and fades with the title instead of being clipped by the h1's `overflow-hidden`. Only Agenda uses it (date picker). The button has a hover fill (`hover:bg-surface-secondary-hover`, `active:bg-surface-secondary-active`, `rounded-control`) and `px-component-sm py-component-xs` padding; the h1 carries a matching negative start margin (`-ms-component-sm`) so the text stays where a plain title would sit. The morph measures the button (padding included), and the outgoing name gets the same padding. The size comes from the caller (Agenda passes `[&_h1]:text-2xl`; the default stays `text-xl`). The visible text is the accessible name.

## Title motion
- `PageHeaderTitle` morphs the title whenever `title` changes on a mounted header (rename) and when a header mounts right after a board switch. The old name (absolute, `animate-blur-out`) and the new name (`animate-blur-in`) overlap while the h1's width goes from the old to the new text width, so the adornments glide. The width is measured (`getBoundingClientRect`), not `interpolate-size`, so Safari and iOS work. The value reaches the h1 as the `--title-w` custom property set via ref and read by `w-[var(--title-w)]`; the property and the width classes are removed when the transition ends, so the h1 returns to its natural width. Duration and easing are the `--blur-fade-in-duration` / `--blur-fade-ease` variables.
- First paint, reloads and static titles (Recepten) never animate: a first render with nothing armed has no "previous" title.
- Reduced motion: no width change, no outgoing text; the new name fades in (120ms).
- The header remounts on a board switch (the route's Suspense fallback is the skeleton), so React state cannot carry the old name. `TeDoenBoardSwitchProvider` calls `armTitleMorph()` (`lib/ui/title-morph.ts`, module scope, 8s cap) just before `router.push`; the skeleton header (`titlePending`) keeps showing that name; the real header then animates from it. Only a board switch arms it, so sidebar navigation between pages never morphs.
- Long names: unchanged; the title still has no truncation of its own. During a morph the text is `whitespace-nowrap` inside an `overflow-hidden` h1.
- Story: `page-header--title-change` (the chevron toggles the name).

## Token gaps and flags
- The root frame's own `itemSpacing` and `paddingRight` (128px) are unbound in the node; the page-padding tokens supersede them (#205).

## Gotchas
- Adornment and action buttons are inert apart from what each page wires: the chevron and star have only an aria-label, no board-switch or favourite persistence in this component. Category creation is wired by the page (#28).
- A page-level dropdown inside the header must rely on this component's `z-10` stacking context; do not add a lower z-index to the header or move dropdowns out expecting them to beat siblings.
- Both stories (`page-header--te-doen`, `page-header--recepten`) are visual baselines; the header's background change regenerates them together.
- Horizontal-scroll containment of the board half of the sticky work: `design/notes/TeDoenBoard.md` and `Carousel.md`.
