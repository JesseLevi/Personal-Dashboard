# AppShell (iOS standalone PWA — #172)

- **Code:** `app/manifest.ts`, `app/layout.tsx` (`appleWebApp`/`manifest`),
  `app/icon.png`, `app/apple-icon.png`, `public/icons/icon-192.png`,
  `public/icons/icon-512.png`, `app/globals.css` (touch polish), plus the
  safe-area changes to `components/organisms/Sidebar.tsx`,
  `components/organisms/SidePanel.tsx`, `components/organisms/PageHeader.tsx`,
  `app/(app)/_components/AppShellNav.tsx`, `components/atoms/Button.tsx`.
- **Node ID:** `4055:14328` ("App icons" section, file `PE9Tc5r8ybDZWVrJrQPqXi`,
  "Notion - V2"), four `IMAGE-SVG` children: `Icon_180x180` (`4055:14318`),
  `Icon_128x128` (`4055:15336`), `Icon_64x64` (`4055:15346`), `Icon_16x16`
  (`4055:15356`). Not a Component/ComponentSet — plain frames, one per export
  size, each a rounded square (`fill_aa157800` = `#F5F5F4`) containing
  lucide's `Loader` glyph (`#79716B`, `opacity: 0.9`, 8 spokes), radius
  scaling proportionally with size (32px at 180, down to ~2.8px at 16).

## Action required after this deploys

**The user must delete the existing home-screen icon on their iPhone and
re-add it from Safari.** iOS reads the manifest/`apple-mobile-web-app-*` meta
tags only at the moment an icon is added to the home screen — an icon added
before this ticket shipped will keep opening in ordinary tabbed Safari
forever, no matter what ships later. This is the one step outside the repo
that makes the rest of this ticket visible.

## Icon rasterization

No SVG-capable rasterizer ships with this Next.js install (no `sharp` in
`node_modules` before this ticket's `pnpm install`, no `rsvg-convert`/
`inkscape` on this machine) and macOS 12's `sips` can't read SVG at all.
`qlmanage -t` (QuickLook thumbnailing) can render SVG, but proved
non-deterministic on this machine — rasterizing the identical `flat-180.svg`
input three times (with an explicit `-r cache` reset in between) produced
fills covering 60%, 61%, and 67% of the canvas respectively, never the full
100%. Not usable for a production asset.

Used **Playwright** instead (`@playwright/test`, already a project
devDependency for `pnpm test:visual` — not a new dependency): load each SVG
in a headless Chromium page sized to the exact target pixel dimensions,
screenshot the `<svg>` element with `omitBackground: true`. Deterministic,
verified pixel-exact against the source (all four corners sampled at exactly
`#F5F5F4`/opaque on the flattened exports, exactly transparent on the
favicon). The one-off generator script was not committed (run once from a
temp path, deleted after).

- **`app/apple-icon.png`** (180×180) and **`public/icons/icon-{192,512}.png`**:
  rendered from the `Icon_180x180` SVG with its `rx="32"` attribute stripped
  before rasterizing — i.e. an actual full-bleed square, not a
  rounded-rect-on-transparent flattened after the fact. iOS does not honour
  `purpose: "maskable"` and does not mask the apple-touch-icon itself; it
  applies its own squircle mask to whatever it's given, so shipping the
  rounded export would leave dark/transparent corners peeking out from
  behind iOS's own rounding. Deliberate call, not an oversight — see ticket
  #172. 512/192 are the same square re-rendered at those pixel sizes (true
  vector re-render via Playwright/Chromium, not a raster upscale of the 180
  export, so there's no interpolation softness).
- **`app/icon.png`** (favicon, 64×64): rendered from the `Icon_64x64` SVG
  as-designed — rounding and transparency intact. Favicons aren't
  device-masked the way home-screen icons are, so there's no corner problem
  to flatten away.
- **Maskable manifest entries**: included (`purpose: "maskable"` on both the
  192 and 512 icons, pointing at the same flattened square PNGs used for
  `purpose: "any"`). Checked the safe zone before adding rather than
  guessing: the glyph's bounding box in the 180-unit source is roughly
  36.7–143.3 on both axes, i.e. content spans ~59% of the canvas, centered —
  comfortably inside Android's required 80%-diameter safe circle (needs
  ≥10% margin per side; this has ~20%). No separate maskable-only asset was
  needed.

## Safe-area audit (`statusBarStyle: "black-translucent"`)

The user chose `black-translucent` deliberately (full-bleed content behind
the status bar), not the ticket body's `"default"` — see `app/layout.tsx`'s
`appleWebApp` comment. That makes every element that can reach the physical
top of the viewport a candidate for rendering under the iOS clock. Audited
the four files #172 named:

- **`Sidebar.tsx`**: already correct (#113) — `pt-[max(1rem,env(safe-area-
  inset-top))]` on the root `<nav>`, shared by both the fixed desktop rail
  and the mobile drawer (same component). No change.
- **`SidePanel.tsx`**: bottom footer safe-area already correct (#113). The
  `<md` shape is a bottom sheet (`inset-x-0 bottom-0`) and never reaches the
  physical top, so it was never at risk. The **`md:` shape** (`md:inset-y-0`,
  full device height) does span from the physical top on desktop-width
  layouts — which a large iPhone in landscape or an iPad can trigger even in
  standalone mode. Added `md:pt-[env(safe-area-inset-top)]` to the panel
  root (not the `h-14` header row directly, to avoid squeezing its fixed
  height). No `max()` needed — there's no base padding to protect, only an
  inset to add when one exists.
- **`PageHeader.tsx`**: genuine gap, now fixed. It's `sticky top-0`, so once
  scrolled its top edge pins flush to the physical top of the viewport,
  putting the title/actions row directly under the status bar/clock in
  standalone mode. Changed to `sticky top-[env(safe-area-inset-top)]`.
  Deliberately **not** the `pt-[max(...)]` padding idiom Sidebar/SidePanel
  use: since sticky's `top` only affects the *stuck* position and has zero
  effect on normal in-flow layout, this adds no visual gap while unstuck —
  padding would have, stacking on top of `AppShellNav`'s own top padding
  every time the page loads unscrolled. `top` was the deliberately different
  (but still `env(safe-area-inset-top)`-based) mechanism for this one
  genuinely different case: chrome that's *intermittently* at the edge
  (sticky, once scrolled) rather than *permanently* there (Sidebar, the
  bottom footer).
- **`AppShellNav.tsx`**: `<main>`'s mobile-only `pt-4` was the other genuine
  gap — the hamburger button (`md:hidden`) is the topmost on-screen element
  before any scroll, and 16px doesn't clear a ~44–59px notch/Dynamic-Island
  inset. Changed to `pt-[max(1rem,env(safe-area-inset-top))]`, matching
  Sidebar's own idiom (this element sits in normal flow only, never sticky,
  so padding is the right mechanism here). `md:pt-20` (80px) was left
  alone — already well past any real inset value.

None of this has run on real hardware — flagged the same way #113's original
safe-area work was (`docs/HANDOFF.md`'s "Unverified against reality" list).

## Touch polish (`app/globals.css`)

Scope note: CSS-only, no new dependency, no service worker, added alongside
#172 per the ticket. All four live next to the existing `.touch-callout-none`
utility (#115):

- `overscroll-behavior: none` and `-webkit-tap-highlight-color: transparent`
  on `html` — document-level defaults, not one component's concern.
- A new `.chrome-touch` utility (coarse-pointer-scoped, same reasoning as
  `.touch-callout-none`) bundles `-webkit-touch-callout: none`,
  `user-select: none`, and `touch-action: manipulation`. Applied to
  `Button.tsx` (every button is a control, not readable content) and to
  `Sidebar.tsx`'s `<nav>` / `PageHeader.tsx`'s `<header>` (explicitly named
  as chrome by the ticket). **Not** applied anywhere near recipe text,
  ingredient names, or notes — those must stay selectable/copyable, and
  nothing in this ticket touches them.
- Double-tap-zoom: no extra `touch-action: none` anywhere — `initialScale: 1`
  (#113) plus `touch-action: manipulation` on the chrome above was judged
  sufficient; content areas were deliberately left alone rather than
  blanket-disabling pinch/double-tap zoom app-wide.

## `apple-mobile-web-app-capable` — Next 15.5 emits the wrong meta name

`appleWebApp: { capable: true }` is documented to produce
`<meta name="apple-mobile-web-app-capable" content="yes">`, the iOS-specific
tag older iOS versions require to enter standalone mode at all. The installed
Next 15.5.20 instead emits `name="mobile-web-app-capable"` — confirmed both
by curling the actual rendered `<head>` and by reading
`node_modules/next/dist/lib/metadata/generate/basic.js` directly (the
`AppleWebAppMeta` function literally hardcodes `'mobile-web-app-capable'`).
Newer WebKit accepts the standards-track name as an alias, but the whole
point of this ticket is standalone mode on the user's real device, so
relying on that alias alone was judged too fragile. Worked around with
`metadata.other: { "apple-mobile-web-app-capable": "yes" }` in
`app/layout.tsx`, which renders the correct legacy tag directly alongside
the (harmless) one Next already emits. Revisit if a future Next upgrade
fixes this upstream — the `other` entry would then be redundant, not wrong.

## `name`/`short_name`/`appleWebApp.title` — not translated

`app/layout.tsx`'s existing `metadata.title` ("Personal Dashboard") was
already a literal string, not a next-intl key, before this ticket. Manifest
`name`/`short_name` and `appleWebApp.title` follow the same precedent
deliberately: a manifest is a static route with no locale to key off (no
request context), and a product name reads as an identifier (closer to a
package name) rather than translatable UI copy. `short_name: "Dashboard"` —
`name`'s full "Personal Dashboard" would truncate on the iOS home-screen
label. ADR-0007 covers UI strings; this isn't read as being in scope for it,
but it's a deliberate call, not an oversight, and is flagged here per
`docs/guides/ui-components.md`'s convention for exactly this kind of call.
