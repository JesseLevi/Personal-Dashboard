# SidePanel

- **Code:** `components/organisms/SidePanel.tsx`
- **Node IDs (canonical in `figma-map.json`: `3779:4846`):**
  - `3779:4846` "Te doen/Mobile/AddItem" (bottom-sheet sample, fields+footer)
  - `3779:4938` "Te doen/Desktop/AddItem" — layer name is literally "y" in Figma, a broken/renamed layer; confirmed by content (identical Input-field set, Bottom footer) that this is the desktop AddItem pane, not something else
  - Dev Mode annotations (fetched via REST API, `get_figma_data` drops them): `3779:4847`/`3878:9048` = "Slides in from bottom" (mobile), `3779:4939`/`3878:9061` = "Slides in from right" (desktop). `3878:9047`/`3878:9060` (AddBoard) share the same chrome, not separately re-fetched — the ticket states they're the same panel with fewer fields.

Built #89. Single organism, both shapes from one markup via `md:`-prefixed Tailwind classes only (no JS breakpoint read — a client-side match check would desync from the CSS breakpoint on first paint and force an extra client boundary). Empty shell: `children` (fields) + `footer` (actions) are composer-supplied; no field/data logic here — that's #94 (card-detail panel).

## Measurements (fetched node, not assumed)

- Overlay fill: `rgba(12, 10, 9, 0.6)` on both nodes — `#0C0A09` at 60% alpha. `#0C0A09` is exactly the `stone-950` primitive that backs the `text` semantic token (light value). **No dedicated scrim/backdrop token exists in `design/tokens.json`**, so the component reuses `bg-text/60` (Tailwind v4's `/60` opacity modifier on the existing `--color-text` custom property) — correct pixels in light mode, per the "reuse existing token, flag the gap" rule (`docs/guides/ui-components.md`). **Flagged gap**: `text`'s dark-mode value is `#FFFFFF` (see `app/theme.css`'s `[data-theme="dark"]` block), so in dark mode this scrim would invert to a *light* 60%-opacity overlay instead of staying dark — visually wrong, but no Next.js app code sets `data-theme` yet (`docs/open-questions.md#dark-mode-is-placeholder-only`), so this is a low-impact, deferred gap consistent with the rest of the codebase's dark-mode state. A real fix needs a theme-invariant scrim token, which is a token-scale decision, not a component-level guess.
- Panel fill: both nodes `#F5F5F4` = `stone-100` = the existing `surface-muted` semantic token (`design/tokens.json`), no gap.
- Mobile panel border-radius: `16px 12px 0px 0px` (top-left/top-right/bottom-right/bottom-left) — genuinely asymmetric (16 vs 12), not a rounding artifact; both values land exactly on Tailwind's scale (`rounded-2xl`=16px, `rounded-xl`=12px), so modelled per-corner: `rounded-tl-2xl rounded-tr-xl` rather than a single `rounded-t-*` utility.
- Desktop panel border-radius: `16px 0px 0px 12px` — top-left 16, bottom-left 12, both right corners square (flush with the viewport edge). Modelled per-corner too, overriding only what changes from the mobile base: `md:rounded-tr-none md:rounded-bl-xl` (top-left's `rounded-tl-2xl` carries over unchanged from the base classes; bottom-right was never rounded on either shape). Verified by measuring `getComputedStyle(dialog).borderRadius` in a real browser at both 402px (`16px 16px 0px 0px` — Tailwind normalizes equal TL/TR into a 2-value shorthand, but computed TL=16/TR=16 do differ from Figma's TR=12; see the second measurement below) and 1440px.
- Mobile panel width: Figma reports a `fixed` 402px, but that is this artboard's own mobile-viewport width (the same "canvas-artifact" pattern `design/notes/Sidebar.md` already documents for its 689px height), not a deliberate fixed-content width — modelled as `inset-x-0` (full viewport width) rather than hardcoded, since a bottom sheet spanning the real device width is the correct generalization.
- Desktop panel width: Figma reports `fixed` 400px, and unlike the mobile case this reads as a deliberate drawer width (the frame's total canvas is much wider than 400px, so 400 isn't "the whole artboard"). Modelled as `md:w-[400px]`, same "no spacing/sizing token layer exists yet" situation `Sidebar.tsx` already flagged for its own 198px/73px — no semantic name to reuse.
- Desktop panel height: Figma reports `fixed` 874px against an 1856-tall parent frame — same canvas-height-artifact pattern as Sidebar's 689px, not modelled; rendered `md:h-full` (viewport height via the `fixed` positioning), flagged for re-verification the same way Sidebar's height is.
- Close button: `Button/Default` `Style=Filled` + `Icon/X`, positioned top-right on both shapes (`x:346,y:16` in a 402-wide frame ⇒ 16px from the top and right edges) — modelled as the header row's own `p-4`/`justify-end`, identical on both breakpoints (Figma agrees: the button sits in the same spot in both nodes).
- Pull-handle (mobile `Top` frame only): a 48px-wide, 4px-thick `stone-300` (`border` token) stroke at `y:12`. **Purely decorative per the ticket — no swipe-to-close is modelled in Figma**, rendered as an `aria-hidden` `<span>` pill (`h-1 w-12 rounded-full bg-border`), hidden at `md:` since the desktop `Top` frame's fetched children never include it.
- Footer ("Bottom" frame): mobile carries `fills=#FFFFFF` (`surface`) + a top-only 1px `#D6D3D1` (`border`) stroke — a visible divider between the scrollable fields and the fixed actions. **The desktop `Bottom` frame carries neither `fills` nor `strokes` in the fetched payload** — no divider, no white strip, footer floats directly over the panel's own `surface-muted` background. This reads as a real, confirmed difference (not a stale/unbound node — both nodes were fetched fresh, side by side) rather than an authoring slip, and is modelled faithfully rather than normalized away: `bg-surface border-t border-border md:bg-transparent md:border-t-0`.

## Deviations from the ticket's own prop proposal

- **`title` is required, not optional** (`title?: string` in the ticket text). The ticket also mandates `role="dialog"` + `aria-labelledby` on the title, which has nothing to point to when `title` is absent — Figma's fetched node has no visible title text at all (no heading layer anywhere in either `Top` frame), so there was no design signal either way for optionality. Requiring it is the only reading that keeps `aria-labelledby` always valid; rendered as a visually-hidden (`sr-only`) `<h2>`, matching Figma's "no visible title" reality while still giving the dialog a real accessible name.
- `className?: string` was added even though the ticket's prop list didn't list it — every other organism in this codebase (`CardContainer`, `Sidebar`, `Dropdown`) exposes it for caller extension; omitting it here would be the one inconsistent leaf.

## Accessibility

`"use client"` (owns open/close focus + keyboard behaviour — identical for every caller, same precedent as `Dropdown`'s intrinsic open state). `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the sr-only title. Overlay click and `Escape` both call `onClose`. A hand-rolled focus trap (no library in `package.json`) cycles `Tab`/`Shift+Tab` among the panel's own focusable elements; opening moves focus to the first one (the close button) and closing restores focus to whatever was focused immediately before opening (`document.activeElement`, captured in the same effect). The panel stays mounted while closed (`inert` + `aria-hidden`, same idiom `Dropdown.tsx` already uses) rather than being conditionally rendered, so both the open and close transitions can actually animate instead of only the open direction.

## Motion

Reuses `--duration-base`/`--ease-base` from #86 — no new timing tokens, per the ticket and `docs/open-questions.md#sidebar-motion-timing-unsourced` (still an unsourced codebase default, unchanged by this ticket). Both the overlay's opacity and the panel's transform use the arbitrary-value form (`duration-[var(--duration-base)]`) — `--duration-base` is not a Tailwind v4 theme namespace, so a bare `duration-base` utility would compile to nothing and silently fall back to the 150ms default (the exact trap #86 documented for `Sidebar.tsx`). `motion-reduce:transition-none` on both layers.

## Ladle / visual baselines

`SidePanel.stories.tsx` has `AddItem` (fields+destructive+filled footer) and `AddBoard` (name-only+filled footer) as the two screenshot-stable open stories, plus a stateful `Interactive` story for manual keyboard/focus testing (`pnpm ladle`) — its default (closed) state is what gets baselined automatically, not a mid-transition frame.

**Known limitation, not silently worked around:** `playwright.config.ts` runs a single `chromium` project at one fixed (desktop-width) viewport — there is no per-story viewport override in the shared `tests/visual/ladle.visual.spec.ts` runner, and `position: fixed` positions relative to the *real* browser viewport, not any Ladle demo wrapper, so no CSS trick inside a story can force the mobile bottom-sheet shape to render under this harness. The scoped baselines this ticket adds (`pnpm exec playwright test --update-snapshots -g side-panel`) therefore only ever capture the **desktop side-drawer** shape for `AddItem`/`AddBoard`, and the trigger-only closed state for `Interactive`. The mobile bottom-sheet shape was verified by hand instead — real Playwright browser, resized to 402px, against `pnpm ladle`'s dev server — see the #89 PR/report for the measured numbers. A real mobile baseline would need a second Playwright project pinned to a narrow viewport, which is a `playwright.config.ts`-wide change affecting every existing baseline, out of scope for a single-component ticket.

## #103: footer full-width, drag-to-close, first-click animation

Review-feedback ticket on the #89/#94 delivery. Three independent fixes, all in this file except the animation fix's actual root cause (which lives in `CardDetailPanel.tsx` — see that note's own #103/#105 entry).

### Footer full-width — container imposes width, buttons opt in to share it

Re-fetched `Bottom` on both nodes (`3779:4950` desktop, `3779:4858` mobile): both `Button/Default` instances have `sizing.horizontal: fill`, confirming the ticket's claim directly from Figma MCP geometry (no REST/annotation fetch needed for this part). Rule: **1 button = 100%, 2 buttons = 50% each**; non-button content (the delete-confirm text) never counts as a column.

Implementation is deliberately split two ways rather than one:
- **The footer container (`SidePanel.tsx`) changed from a `flex … items-center gap-2` row to `flex … flex-col gap-2`.** A column's default `align-items: stretch` forces every direct child to full width for free — including a lone composer-supplied row, with zero extra classes. This is what lets the delete-confirm text sit on its own full-width line above the button row without SidePanel needing to know button count or content shape (it still doesn't — `footer` stays an opaque `ReactNode`).
- **Each footer Button opts in to an equal share of its own row via `grow basis-0`** (composer's job — see `CardDetailPanel.tsx`/`BoardPanel.tsx`). Deliberately **not** `flex-1`: that shorthand also sets `flex-shrink`, landing on the exact same CSS property `Button.tsx`'s own `shrink-0` (#80) already sets — mixing the two would make the outcome depend on compiled-stylesheet emission order, the identical trap `docs/design-tokens.md`'s Outline/Selected history already documents (verify-the-compiled-CSS, not assume-the-source-order). `grow`(flex-grow) + `basis-0`(flex-basis) touch none of the properties `shrink-0` sets, so order can never matter.

Net effect: `shrink-0`'s `flex-shrink: 0` only ever governs a Button's *own* row (whether it's willing to shrink below its own content when squeezed) — it says nothing about whether a *column* parent stretches that row to full width, since stretch is a cross-axis concern the column's `align-items` controls, independent of any flex-grow/shrink/basis on descendants. So none of the dozens of other `Button` call sites (which stay in ordinary flex ROWS, never nested in a column footer) are affected — confirmed by `pnpm typecheck`/`pnpm lint`/`pnpm test` all passing with zero other call sites touched.

**Measured** (real browser, `pnpm ladle`, Playwright MCP, both required widths — post-rebase onto #99's re-authored `Button`, whose `justify-between px-2` + `trailingIcon` restructuring doesn't touch `shrink-0` or add any width, so the numbers hold before and after):

| State | 402px | 1440px (400px drawer) |
|---|---|---|
| 1 button (`CreateItem`) | button 370px = full row (402 − 16px×2 padding) | not re-measured (same math, no reason to differ) |
| 2 buttons (`EditItem`, Delete+Save) | 181px / 181px (row 370px − 8px gap, halved) | 181px / 179px (row 368px − 8px gap, halved) |
| Delete-confirm (text + Cancel/Confirm) | text 370px full-width; buttons 182px / 180px | text 368px full-width; buttons 181px / 179px |

### Drag-to-close (mobile only, `<md`) — codebase decision, not a Figma read

**Explicit flag per the ticket:** Figma models *no* gesture at all on either fetched node (`3779:4846`/`3779:4939`) or their annotations (`3779:4847`/`3878:9048` = "Slides in from bottom", `3779:4939`/`3878:9061` = "Slides in from right" — motion *direction* only, nothing about drag/swipe). The gesture, its scope (`<md` only — desktop keeps X/Escape/overlay-click), and every threshold below are a codebase-side product decision the user made directly (2026-07-25), not something read off the design.

**Note on how the annotation text above was obtained:** the sandbox's network policy blocked a direct `curl`/REST call to `api.figma.com` in this session (`X-Figma-Token` header isn't reachable via the generic `WebFetch` tool, and raw `curl` was denied by the environment's command classifier). The annotation text quoted above is not a fresh fetch — it's carried over from the ticket body itself and this file's own #89 entry, both of which independently record the identical label text from a prior real REST fetch. Flagging this honestly rather than presenting it as a fresh pull: if a future ticket needs a *different* annotation, it needs an environment where the REST call actually succeeds, or the MCP server, not this file's precedent.

Implementation: pointer events (no new dependency — `@dnd-kit` is board-only, not used here) on the header strip (`h-14`, holds the pull-handle + close button), imperative direct `style.transform`/`style.transitionDuration` writes on `panelRef` (no React state per pointermove, so no re-render tax on a 60fps-ish drag). Scoping rules, each verified in a real browser (Playwright MCP, dispatched `PointerEvent`s, `pnpm ladle`):

- **Starts only in the handle strip, never the fields area** — a drag dispatched inside the `overflow-y-auto` fields container (well past the close distance) produced zero movement and no close; confirmed by `getBoundingClientRect().y` staying exactly at its resting value throughout.
- **Never hijacks the close button's own click** — `pointerdown` bails immediately if the event target is inside a `<button>` (`.closest("button")` check), so a tap-with-negligible-movement on the X button is untouched; the gesture only ever engages from the empty strip area or the decorative pull-handle span.
- **Inert at `≥768px`** — checked via `matchMedia("(min-width: 768px)")` at drag-*start* only (not on every render, preserving the "no JS breakpoint read" rule for markup — this is the one deliberate runtime-behaviour exception, documented in the component's own header comment). Verified: the same drag sequence that closes at 402px left the panel's `x`/`y` completely unchanged at 1440px and it stayed open.
- **Live 1:1 follow while dragging** — `getBoundingClientRect().y` tracked the synthetic pointer's `clientY` exactly (e.g. dragging 130px down moved the panel from y=87 to y=217).
- **Existing CSS transition disabled for the drag's duration** (`transitionDuration = "0s"` set imperatively at drag-engage, `removeProperty` on release/cancel) so the live transform can't fight the class-driven one; confirmed no lag/fighting in the sampled frames.
- **`prefers-reduced-motion: reduce`**: emulated via Playwright (`page.emulateMedia`). The open/close CSS transition is skipped (panel jumps straight to its final position, matching the existing `motion-reduce:transition-none` class — verified: with reduced motion on, `getBoundingClientRect().y` was already at its final value 50ms after a programmatic open, vs. ~220ms of interpolation with reduced motion off). The **gesture itself still worked** under reduced motion (drag-follow + close-past-threshold both fired identically) — it was never gated on the media query, only the transition was, matching the ticket's "no transform-animatie, maar het gesture zelf mag blijven werken."

**Thresholds chosen** (no Figma source; documented per the ticket's own "kies zelf, documenteer de waarden"):

```
DRAG_SLOP_PX = 8            // ignores a tap's own jitter before treating movement as a real drag
DRAG_CLOSE_DISTANCE_PX = 120 // a deliberate pull, not an accidental few-px nudge
DRAG_CLOSE_VELOCITY_PX_MS = 0.5 // 500px/s — a fast flick still closes even if released short of DISTANCE
```

Both a slow-but-far drag (130px, low velocity) and a fast-but-short one are treated as "close" — verified independently: a slow 130px drag closed on release (past DISTANCE); a slow 40px drag (under DISTANCE, low velocity) snapped back to the open position instead. Release always removes the inline transform + duration override in the same synchronous handler as the (possible) `onClose()` call; React 18's automatic batching means both land in the same commit, so the browser's transition picks up cleanly from the last-painted (dragged) position to whichever target (open, on snap-back, or closed) the class now computes — no observed flash back to fully-open before closing.

### First-click animation bug — root cause and how it was proven

**Diagnosed in a real browser before writing any fix**, per the ticket's own instruction not to pattern-match. Reproduction: `card-detail-panel--interactive` Ladle story (fresh navigation each time), sampling `document.querySelector('[role="dialog"]').getBoundingClientRect().y` on every `requestAnimationFrame` immediately after a click, plus comparing the dialog element's own object identity (`===`) across samples.

- **Ruled out:** "browser has no prior painted frame within the same frame" (candidate cause #1). A plain first-ever open (clicking "create" on the story's own default target, which reuses the initial key) interpolated correctly on the very first try — `y` moved smoothly from 874 → 87 over ~220ms, `sameNode: true` throughout.
- **Confirmed:** the composer's `key`-per-target remount (candidate cause #2, `CardDetailPanel.tsx` ~line 62 pre-fix). Clicking "edit" as the first interaction — the realistic case, since almost no real user's first click matches the panel's own default initial target — showed `sameNode: false` on every sampled frame (a brand-new DOM node) and `y` already at its final value (87) on the very first sample, zero interpolation frames. The remount destroyed the previously-mounted *closed* SidePanel `<div>` and created a fresh one already `open`, with no previously-painted closed frame for the CSS transition to interpolate from.
- **Scope is wider than "the first click"**: the same broken pattern reproduced on *every* target-changing open, not only the very first one — closing and reopening the same already-mounted key animates fine, but switching to a target whose key has never been mounted before glitches every time, first click or fifth. The ticket's own framing undersold this.

**The fix lives in `CardDetailPanel.tsx`** (in-scope for this ticket per "the key/reset logic," shared ownership with #105 — see that file's own design note for the mechanism), not here: it stopped remounting SidePanel on target changes at all, so its dialog `<div>` is now a single persistent DOM node for the component's whole lifetime. Re-verified post-fix with the identical sampling method: the exact scenario that broke before (first click = edit, never-before-mounted key) now shows `sameNode: true` throughout and smooth 874→87 interpolation over ~220ms — proving the fix, not asserting it.

### #113 (2026-07-27/28) — stale overlay strip after close, drawer not reaching mobile edges

Reported on a real iPhone; `#111`'s fix (clearing a residual inline `transform`) shipped and did not resolve it. **Two symptoms, two different mechanisms — measured separately, not assumed to share a cause.**

**Symptom 1 (dark strip after close).** Hypothesis under test: the overlay (`fixed inset-0 bg-text/60`) stayed mounted and composited at `opacity-0` when closed (only `pointer-events-none opacity-0`, no `visibility` change), and iOS Safari's own translucent-chrome tinting sampled that stale layer. Fixed by adding `invisible` (mobile: `visibility: hidden`) alongside `opacity-0`, plus Tailwind's `transition-discrete` (`transition-behavior: allow-discrete`) so the discrete `visibility` flip is deferred to the *end* of the opacity transition instead of firing immediately and killing the fade. **Measured, not assumed**: sampled the overlay's computed `visibility`/`opacity` every 60ms through a real close (Playwright, `side-panel--interactive` story) — opacity interpolated smoothly `0.57 → 0.11 → 0.004 → 0` while `visibility` stayed `"visible"` throughout, flipping to `"hidden"` only in the same ~60ms window opacity finished. The fade-out animation and the "genuinely drop the compositing layer" goal are both confirmed working in Chromium. **Whether this is *the* fix for the iOS artifact is unverified** — Chromium has no translucent OS chrome to tint, so the specific failure mode cannot be reproduced here; this is the correct, testable half of the fix, not a claim the symptom is resolved.

**Symptom 2 (mobile drawer not reaching top/bottom edges) — this is `AppShellNav.tsx`'s drawer, not this file, but the finding belongs with the mechanism.** Measured, before changing anything: built a minimal static page reproducing the drawer's exact CSS shape (`position: fixed; top: 0; bottom: 0` + a child `height: 100%`) and loaded it in Chromium at a phone-sized viewport (390×844) — the drawer's box measured `top: 0, bottom: 844, height: 844`, **exactly** `window.innerHeight`, zero gap either edge. This rules out a plain CSS box-model bug in the drawer's own classes (`fixed inset-y-0` + `h-full` is provably correct). The leading hypothesis, backed by documented Safari behaviour rather than guessed: `app/layout.tsx` exported no `viewport` at all before this ticket, so Safari kept the *layout* viewport clipped to its own "safe" area by default — every `fixed`/`inset-*` element in the app (this included) was constrained short of the true screen edges regardless of its CSS, and the "dark strips" are that unclipped chrome, not a sizing defect. Added `viewportFit: "cover"` to a new `app/layout.tsx` viewport export (previously missing entirely) as the standard opt-in, plus `max(1rem, env(safe-area-inset-*))` padding on `Sidebar.tsx`'s own container and this file's mobile footer (`pb-[max(1rem,env(safe-area-inset-bottom))]`) so content doesn't start rendering under a notch/home-indicator once the page can extend under them. **Unverified on-device** — this is the best-supported hypothesis (measured CSS correctness + documented Safari viewport semantics), not a confirmed fix; report it as "needs on-device testing," not "resolved."

**Also added**: `themeColor` on the same `viewport` export (`#F5F5F4`, the literal hex `<meta name="theme-color">` needs — no CSS var is resolvable that early; sourced from `primitive.color.stone-100` / `semantic.surface-muted` in `design/tokens.json`, the same value `<body>` already paints. `app/layout.tsx` is outside `components/`, so this isn't a `check:server-only` violation, but it's still traceable to a real token, not invented).

### #149: `level` prop — stacking a second panel above the first

`RecipePanel` can now open a second real `SidePanel` on top of itself (`StepIngredientPanel`, and `IngredientSearchPanel` reused for the same purpose) — both previously used the *same* `z-40`/`z-50` pair, so the second panel's own scrim painted **under** the first panel's `z-50` instead of dimming it, the exact bug the fetched `StepIngredientPanel` node (`3749:3241`) rules out: its `Overlay` rectangle is a full-screen `rgba(12,10,9,0.6)` at `0,0` sized `402×874` — i.e. it is drawn to cover the *first* panel too, not just the page behind both.

Added `level?: 1 | 2` (default `1`, unchanged today's `z-40`/`z-50`). `level={2}` moves both layers up one notch — `z-[60]` scrim / `z-[70]` panel — arbitrary-value classes since Tailwind's default `z-*` scale stops at 50 (same "no token for this yet" precedent as this file's own `w-[400px]`). This only ever needs two levels (the deepest nesting any caller reaches today is one panel opening one more), so a numeric depth prop was scoped down to a plain `1 | 2` union rather than an arbitrary stack depth/z-index prop — cheap to widen later if a third level is ever needed.

Not a z-index arms race against anything else in the app: `AppShellNav.tsx`'s mobile drawer deliberately mirrors this component's level-1 `z-40`/`z-50` (its own comment says so) and nothing in the app goes higher, so `z-[60]`/`z-[70]` only ever have to beat this component's own level-1 values, never a third unrelated layer.

### Cross-ticket risk check (#101/#102 — fixed sidebar + mobile drawer, sticky header)

`AppShellNav.tsx`'s mobile drawer (`fixed … transition-transform`, the one element in that file that could matter — `transform` on an ancestor breaks a `fixed` descendant's positioning) is a **sibling** of `main`/`children` in the returned tree, not an ancestor — `SidePanel` mounts somewhere under `main`, never under the drawer, so the drawer can never become its containing block regardless of open/closed state. `PageHeader.tsx` only uses `sticky` (no `transform`/`filter`/`contain`), which doesn't establish a containing block for `fixed` descendants at all. Confirmed by reading both files after rebasing onto `main`; **not** re-verified by rendering the actual `/te-doen` page inside the live app shell, since this dev machine has no Docker/Supabase and `/te-doen` needs a signed-in session — SidePanel's own `fixed` positioning and transitions were re-verified in isolation (Ladle) post-rebase instead, at both 402px and 1440px.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on "Te doen/Mobile/AddItem"
(3779:4846) and its "Pull-up panel" child (3779:4847). `rounded-tr-xl`
(mobile) / `md:rounded-bl-xl` (desktop) → `rounded-tr-control-outer` /
`md:rounded-bl-control-outer` (`topRightRadius`→`radius/control-outer` on
the fetched mobile node; the desktop corner is this file's own
already-documented "16px 0px 0px 12px" measurement, same 12px→
control-outer reasoning applied consistently, not independently re-fetched
this round). Fields column `gap-6`→`gap-stack-xl`
(`itemSpacing`→`spacing/stack/stack-xl`, matches "Pull-up panel"'s own
binding); its `px-4`/`pb-4`→`px-component-lg`/`pb-component-lg`
(`paddingLeft/Right`→`spacing/component/padding-lg`). Handle-strip `px-4`→
`px-component-lg` (same token family, same row). Footer `gap-2`→
`gap-inline-sm`, `p-4`→`p-component-lg`, and its desktop-only `md:pb-4`→
`md:pb-component-lg` (all from "Bottom", 3779:4858: `itemSpacing`→
`spacing/inline/gap-sm`, `padding*`→`spacing/component/padding-lg`).

**Left unconverted, flagged:** `rounded-tl-2xl` (mobile) — the fetched
node's `topLeftRadius` (16px) binds `spacing/component/padding-lg`, a
SPACING variable, not a radius one; a genuine Figma authoring artifact, not
a missed lookup. 16px also has no step in this pipeline's `radius` scale
(4/6/8/12/24) regardless. The mobile-only safe-area `pb-[max(1rem,...)]`
on the footer stays raw too, same reasoning as `Sidebar.tsx`'s own
`pt-`/`pb-`.
