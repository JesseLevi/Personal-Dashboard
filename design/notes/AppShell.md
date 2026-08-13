# AppShell (iOS standalone PWA — #172, #223)

- **Code (#172):** `app/manifest.ts`, `app/layout.tsx` (`appleWebApp`/
  `manifest`), `app/icon.png`, `app/apple-icon.png`,
  `public/icons/icon-192.png`, `public/icons/icon-512.png`,
  `app/globals.css` (touch polish), plus the safe-area changes to
  `components/organisms/Sidebar.tsx`, `components/organisms/SidePanel.tsx`,
  `components/organisms/PageHeader.tsx`,
  `app/(app)/_components/AppShellNav.tsx`, `components/atoms/Button.tsx`.
- **Code (#223):** `app/(app)/te-doen/icon.png`,
  `app/(app)/recepten/icon.png`, `app/(app)/winkelmand/icon.png`,
  `app/(app)/notities/icon.png` — file-convention favicons only, no `.tsx`
  changes anywhere (see "#223: per-page favicons" below).
- **Node ID (root, #172):** `4055:14328` ("App icons" section, file
  `QwWEkv3z4DKsipNQVrMIyQ`, "Notion - V2"). As of #223 this section holds
  **four icon sets of four sizes each (16 frames)**, not the original single
  set — see the table below. The frames #172 used are still there
  (`Icon_TeDoen_*`, same node-ids as before) but their *content* changed:
  each is now a rounded square (`fill` bound to `color/surface/primary/
  default`, resolves `#F5F5F4`) containing an **`Icon/*` component
  instance** (lucide glyph rendered as strokes on
  `color/text/base/secondary` → `#79716B`, `opacity: 1`), not the bare
  8-spoke `Loader` vector at `opacity: 0.9` this file previously described.
  Root `app/icon.png`/`app/apple-icon.png`/`public/icons/*` were **not**
  regenerated in #223 — they still show that already-shipped TeDoen render;
  see the per-page decision below for why they were deliberately left
  alone rather than re-rendered to match the new instance-based source.

## #223: per-page favicons (2026-08-13)

### Figma: four icon sets, 16 frames, all measured via `figma-console`

`4055:14328` ("App icons", *Development* page) now contains one frame per
page × size. Measured directly (`figma.getNodeByIdAsync` +
`boundVariables`, not inferred from resolved colour) — every frame shares
the same fill/stroke binding, only the glyph instance differs:

| Page | Glyph (`Icon/*` instance) | 180×180 | 128×128 | 64×64 | 16×16 |
| --- | --- | --- | --- | --- | --- |
| Te-Doen | `Columns-3` | `4055:14318` | `4055:15336` | `4055:15346` | `4055:15356` |
| Notities | `Notebook` | `4078:20071` | `4078:20073` | `4078:20075` | `4078:20077` |
| Recepten | `Folder-closed` | `4078:20115` | `4078:20117` | `4078:20119` | `4078:20121` |
| Winkelmanden | `Shopping-basket` | `4124:16787` | `4124:16789` | `4124:16791` | `4124:16793` |

Every frame: `cornerRadius` 32 at 180 (proportional at smaller sizes, same
scaling as #172), fill → `color/surface/primary/default` (`#F5F5F4`),
glyph drawn as **strokes** (not fills) → `color/text/base/secondary`
(`#79716B`), `stroke-width` 10.667 at 180 scaling proportionally,
`opacity: 1` throughout (the old Loader-glyph note's `opacity: 0.9` doesn't
apply to any of these). Only the 180×180 and 64×64 frames were exported —
same precedent as #172 (128/16 exist in Figma but aren't part of the used
export set).

Export note: the Figma REST route (`GET .../images/<key>?ids=...`) worked
for this session despite a mid-task warning that its token had expired —
every SVG it returned was cross-checked byte-for-byte against
`figma.getNodeByIdAsync(id).exportAsync({format:'SVG'})` run through the
`figma-console` bridge (all four 64×64 exports matched exactly, glyph paths
included), so the asset content itself is not in question either way.

### Decision: favicon per page ships; home-screen icon/manifest does not

The ticket asked for two things — a per-page **favicon** and a per-page
**home-screen icon + shortcut that opens that page**. Only the first ships
here.

**Favicon (`app/<route>/icon.png`) — shipped, all four pages.** Purely
file-convention: Next.js's icon collector runs for every route segment
(`collectIconModuleIfExists('icon')`, unconditional — confirmed reading
`next/src/build/webpack/loaders/metadata/discover.ts`), and a leaf
segment's static icon overrides its parent's via `unshift` at render time
(`next/src/lib/metadata/resolve-metadata.ts`) — so a more specific route's
`icon.png` wins over the root's with zero code, zero risk to any other
route. `pnpm build` confirms it: `/te-doen/icon-*.png`,
`/recepten/icon-*.png`, `/winkelmand/icon-*.png` and `/notities/icon-*.png`
(inert until #232 adds a page there) all appear as distinct generated
routes; root `/icon.png` is unchanged. A favicon has no bearing on PWA
install identity — it's browser-tab/bookmark chrome only — so this is safe
in isolation.

**Home-screen icon (`apple-icon.png`) + shortcut destination — not
shipped, deliberately.** These two have to move together or not at all:
shipping a route-specific `apple-icon.png` alone would show (say) the
Recepten glyph on the home-screen icon while the shortcut still opens
`/te-doen` — worse than today's single consistent icon, not better,
because it actively misrepresents where the shortcut goes. Whether the
*destination* can be made per-page turns on how iOS resolves
`start_url` from a linked Web App Manifest, and here's what research
turned up, sourced rather than guessed:

- **iOS honours the manifest's `start_url` over the current URL, not the
  other way round, once a manifest is linked and `apple-mobile-web-app-
  capable` is present** — this app already has both, globally, from
  `app/layout.tsx`/`app/manifest.ts` (#172). Real-world confirmation:
  [gitlab-org/gitlab#427560](https://gitlab.com/gitlab-org/gitlab/-/issues/427560)
  documents the exact failure shape — adding GitLab's To-do List page to
  the iOS home screen opens Explore Projects instead, because the single
  shared manifest hardcodes that `start_url`. That is the bug this
  ticket's request is implicitly asking not to have; it is *also*,
  unavoidably, this app's current behaviour on every route today (one
  manifest, `start_url: "/te-doen"`, since #172).
- **`apple-touch-icon` (i.e. `apple-icon.png`) already takes precedence
  over manifest icons on iOS**, and — same mechanism as the favicon above
  — Next.js would happily serve a different one per route. That part is
  low-risk on its own; it's only risky *paired with* an unfixed shared
  `start_url`.
- **A technically real fix exists but is unverified on iOS specifically:**
  Next.js's `manifest.ts` file convention is root-only by construction
  (`isRootLayoutOrRootPage` gate, confirmed in
  `next/src/build/webpack/loaders/metadata/discover.ts` — a nested
  `app/te-doen/manifest.ts` is never picked up). The supported alternative
  is `metadata.manifest: "<url>"` in any layout/page pointing at a custom
  Route Handler (confirmed in `next/src/lib/metadata/metadata.tsx`), so a
  per-page manifest (own `start_url`, `scope`, `id`) is buildable. Safari
  16.4 (March 2023) added the manifest `id` member specifically to let iOS
  tell apart "multiple installs of the same web app" sharing an origin —
  which is suggestive that per-page manifests *could* resolve to
  independent, correctly-routed home-screen installs. No source found,
  however, confirms this exact scenario (N manifests, one origin, N
  independent iOS installs) actually behaves that way, and the one
  concrete real-world data point available (the GitLab issue above) only
  demonstrates the *failure* mode of a single shared manifest, not that
  the multi-manifest fix generalises safely. This cannot be tested here —
  no iOS hardware — and a wrong guess ships a broken or merged PWA
  identity, worse than the current one. Per this ticket's own fallback
  instruction, that's a "can't reliably substantiate it" case: conservative
  choice taken. Tracked as
  `docs/open-questions.md#per-page-home-screen-icon-unverified` for a
  follow-up ticket that *can* be checked against a real device.

Root `app/apple-icon.png`, `public/icons/*`, and `app/manifest.ts` are
therefore **untouched** by #223 — every route's home-screen representation
stays exactly what #172 shipped (single icon, `start_url: "/te-doen"`).

### Notities: assets shipped, wiring deferred to #232

`app/(app)/notities/` has no `page.tsx` yet (#232), so `/notities` doesn't
route and `app/(app)/notities/icon.png` is inert today — but Next's icon
file convention needs nothing beyond the file's presence at that path, so
the moment #232 adds `page.tsx` the favicon starts working with **no
further code change**. No `layout.tsx` was added speculatively: a bare
pass-through layout whose only job is scaffolding for a not-yet-written
page risks colliding with whatever #232 actually needs there, for a
saving of one file #232 can add itself in a few seconds. Same call as the
apple-icon/manifest question above — Notities gets no home-screen-icon
route wiring either, for the same reasons.

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

## App-level dark mode: system preference only, no switch (#206)

- **Code:** `app/layout.tsx` (`next-themes`' `ThemeProvider`, `<html
  suppressHydrationWarning>`, `viewport.themeColor` array), `app/manifest.ts`
  (comment only, value unchanged), `package.json` (`next-themes` dependency).
- **Config:** `attribute="data-theme"`, `defaultTheme="system"`,
  `enableSystem` — exactly the ticket's three props, nothing else passed.
  `enableColorScheme` (default `true`) is left implicit rather than restated:
  next-themes sets `document.documentElement.style.colorScheme` to the
  resolved theme alongside the attribute, which is what flips native form
  controls and the scrollbar — satisfies that DoD line with zero extra code.
  No static `<meta name="color-scheme">` added: it would only assert "both
  supported" before the dynamic value lands, and the inline script (below)
  sets the real one before first paint anyway, so a static tag would be
  redundant at best.
- **No switch UI, deliberately**: not in Figma, and `docs/guides/
  ui-components.md`/`CLAUDE.md` both forbid inventing UI absent from Figma.
  `ThemeProvider` supports one without any change once a Figma node exists.
- **No-flash mechanism, verified, not assumed**: next-themes renders an
  inline, non-async `<script>` (`dangerouslySetInnerHTML`, no `defer`) as
  the *first* child inside `ThemeProvider`'s own output — i.e. the first
  thing inside `<body>`, ahead of `NextIntlClientProvider`/`children`. A
  synchronous inline script blocks HTML parsing at that exact point, so it
  always runs (reading `localStorage`, then `matchMedia('(prefers-color-
  scheme: dark)')` when no stored value exists) and sets `data-theme` +
  `style="color-scheme:…"` on `<html>` before the browser paints anything
  after it — confirmed by reading `next-themes`' own `theme-script.md`/
  `index.tsx` source via Context7, not assumed from the README description
  alone. `suppressHydrationWarning` on `<html>` is required because of this:
  the script mutates attributes React didn't render server-side, which
  would otherwise log a hydration mismatch.
- **Streaming shell (#170) — checked, not regressed**: the script is part of
  the root layout's own (non-Suspense) HTML, which is exactly what #170
  already flushes first, ahead of every route's `loading.tsx` skeleton and
  the streamed board data. It adds no network request (bundled inline) and
  is a handful of synchronous statements — `curl`'d the SSR'd `/te-doen` and
  `/recepten` HTML directly: the script tag lands in the first flushed
  chunk, before the `PageSkeleton` fallback markup, in both. Did not have an
  authenticated browser session to capture a Lighthouse/TTFB trace against a
  real login (see #185's standing gap) — the "no added network cost, no
  added render-blocking work beyond one inline script" argument above is
  reasoned from the source and the flushed-HTML order, not measured against
  a live metric. Flagging rather than claiming a number.
- **`viewport.themeColor` becomes a light/dark pair**: Next.js's
  `themeColor` field accepts an array of `{ media, color }` and emits one
  `<meta name="theme-color" media="…">` per entry — Safari 15+ and Chrome
  93+ (installed PWAs) read `media`, everything else falls back to the
  first entry (light). Dark value `#1C1917` is `surface-primary`'s upcoming
  Figma dark value (stone-900, #204/PR #208 — not merged as of this
  ticket) chosen so this doesn't need touching again once that token
  lands; **until #204 merges, `<body>`'s actual background stays light in
  dark mode** (`surface-primary` has no dark override in `app/theme.css`
  yet) even though the address-bar chrome already switches — a real,
  temporary, and expected mismatch, not a bug in this ticket's code.
- **`app/manifest.ts`'s `theme_color`/`background_color` stay single-valued,
  on purpose**: the Web App Manifest spec has no `media`-query equivalent
  for either field (confirmed via W3C manifest issue #975, still open as a
  proposal, not shipped) — unlike the `<meta>` tag above, there is no
  dark-mode value to add. Kept at the existing light hex (`#F5F5F4`)
  rather than switched to a dark guess, since these fields drive the
  Android/desktop PWA splash screen and install chrome, which render before
  any theme can be detected — a wrong dark guess would be visibly worse
  than a correct, static light value. Revisit only if `user_preferences`
  ships broadly, or per-mode manifest icons/colors become a real ticket.
- **Playwright visual suite (#6/ADR-0010) stays light-only, deliberately**:
  `tests/visual/ladle.visual.spec.ts` exists to catch pixel drift against
  *fetched Figma nodes* (`docs/guides/ui-components.md`'s "pixel-parity is
  verified, not assumed"). No Figma dark frames exist for any component to
  diff a dark screenshot against, so a dark baseline would only be
  checking "did this pixel change since last run" with no independent
  source of truth — and would double the already-flaky baseline set (see
  `docs/HANDOFF.md`'s visual-flake note) for a mode this ticket's own DoD
  doesn't require baseline coverage of. Not run: no `dark` project/story
  variant was added to `.ladle/components.tsx` or `playwright.config.ts`.
  Ladle's existing Light/Dark toggle remains the way to eyeball a component
  in dark mode by hand.
- **Verification actually performed**: see the PR/commit description for
  what was and wasn't confirmed against a real signed-in session versus
  Ladle only — #185's "no authenticated run has ever happened" gap applies
  here too and is not closed by this ticket.
- **The login page's marketing visual stays light in dark mode**, and that is
  an asset gap rather than a token bug: `app/login/page.tsx`'s right-hand panel
  is a static `<Image>` (`/login/login-visual-{mobile,desktop}.png`), a
  light-mode render of the product. Verified while confirming #206 — the
  surrounding page does switch correctly (`data-theme="dark"`, body background
  stone-100 → stone-900), it is only the PNG that doesn't. A dark counterpart
  has to come from design; inventing one here would be building UI Figma
  doesn't have. Tracked as `docs/open-questions.md#login-visual-has-no-dark-asset`.

## TICKET #205 (2026-08-12): page-padding token

`AppShellNav.tsx`'s `<main>`: `pl-4 md:pl-32`→`pl-page-left`. No node
lookup needed — the ticket's own page-padding rule treats this split (16
mobile / 128 desktop) as unambiguous, already backed by
`app/theme.css`'s `@media (min-width: 768px)` override. `pt-[max(1rem,...)]`/
`pb-20`/`md:pt-20`/`md:pb-20` stay raw, unchanged: they compose the
safe-area idiom documented above, a different (and riskier to touch)
concern than plain page padding, out of this ticket's explicit `pl-`/`pr-`
scope.

## #219

`AppShellNav.tsx:197` (`<main>`), measured against `Pages/Navigation`
(`3889:16890`) → `Mobile/Navigation/01` (`3889:15957`) and
`Desktop/Navigation/01` (`3889:17167`), specifically each frame's `Main`
child (`3889:15958` mobile, `3889:17169` desktop):

| old utility | new utility | node-id | `boundVariables` key | variable |
| --- | --- | --- | --- | --- |
| `gap-6` | `gap-page-stack` | `3889:15958` / `3889:17169` | `itemSpacing` | `spacing/layout/page-stack` (24px both) |
| `pb-20 md:pb-20` | `pb-page-bottom` | `3889:15958` / `3889:17169` | `paddingBottom` | `spacing/layout/page-padding-bottom` (80px both) |

`pl-page-left` was already correct (pre-existing, #205) — re-confirmed
against the same nodes' `paddingLeft` → `spacing/layout/page-padding-left`
(16→128, self-switching).

**Left raw and flagged**: `pt-[max(1rem,env(safe-area-inset-top))] md:pt-20`.
`paddingTop` on both measured `Main` nodes is bound to
`spacing/layout/page-padding-top` (16 mobile → 80 desktop, self-switching
via `app/theme.css`'s unlayered `@media` block — one of the three bold
tokens in the shared briefing's vocabulary table). That token alone,
`pt-page-top`, would reproduce the *numbers* exactly, but not the
*behaviour*: the mobile branch is deliberately `max(1rem,
env(safe-area-inset-top))`, not a flat `1rem`, to clear a notch/home-
indicator in standalone iOS (#172, see the ticket log above). Two ways to
fold it in were considered and rejected:

- `pt-page-top` (drop `max()` entirely) — would silently regress #172's
  fix on notched devices. Ruled out by this ticket's own "never drop the
  safe-area behaviour" instruction.
- `pt-[max(1rem,env(safe-area-inset-top))] md:pt-page-top` — forbidden
  outright by the ticket brief: `page-top` already switches itself past
  768px via the CSS-level media query, so an explicit `md:` prefix on it
  is exactly the double-application the brief calls out by name.

A `pt-[max(var(--spacing-page-top),env(safe-area-inset-top))]` single
arbitrary-value utility (referencing the token's own CSS variable) was
considered as a third option — it would preserve the safe-area guard at
*every* breakpoint, including desktop, where the current code
deliberately does not apply it (`md:pt-20` is a flat value; the file's own
comment says "`md:pt-20` already clears any real inset"). That's a
behaviour change, not a refactor — extending safe-area handling to
desktop is a design/product call, not something to slip in silently while
converting a spacing utility. **Flagged for a decision rather than
applied** — see "Open question" below.

### Open question — should desktop `pt-` also carry the safe-area `max()`?

`md:pt-20` is currently a flat value with no `env()` guard, on the stated
assumption that 80px of padding already clears any real safe-area inset
on desktop form factors. That assumption predates this ticket and wasn't
re-verified here (no on-device signal, same caveat as this file's #172
entries generally). If a future device combines a wide/desktop-width
viewport with a nonzero top inset (e.g. a landscape foldable), `md:pt-20`
would not compensate. Worth a real design decision before folding `pt-`
into a single token-driven `max()` expression — not decided unilaterally
in this ticket.
