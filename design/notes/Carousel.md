# Carousel

- **Code:** `components/organisms/Carousel.tsx`
- **Node ID:** `3670:1976`

Built #24. Single COMPONENT, no componentPropertyDefinitions and no fill, so no variant/state axis and no colour to model — no CVA, clsx merges className, same as Card/CardContainer. Root (row, gap 16px, sizing horizontal=contextual/vertical=hug) wraps one SLOT 'Slot' (row, gap 16px, sizing horizontal=fill/vertical=hug) -> required `children`. Root and Slot share the identical row/gap-16 layout, differing only in Figma's sizing keyword (contextual vs fill), which render identically once nested — collapsed into a single wrapping div (w-full gap-4) rather than adding a second no-op div, same 'no visible effect' precedent Card.tsx's own doc comment used for its non-clipping corner radius. The fetched example instance nests 3x `Card-container` (node 3650:1297, i.e. CardContainer.tsx), not bare Card — confirms CardContainer.tsx's own note that its 'Carousel details' header frame belonged to this not-yet-built parent; the ticket's 'row of Card instances' phrasing undersold it. No user-facing strings of its own; the Ladle story reuses CardContainer's existing addLabel/editLabel message keys, no new i18n keys needed.

## Additional fact (moved from component doc comment, comment-shrink pass)

Data wiring (which columns render, live counts) is explicitly out of scope for this organism — it stays presentational only, composer-supplied `children`.

## CORRECTED post-review (orchestrator caught it, same ticket)

the first pass rendered each Card-container child at `w-full`, which in a flex row means equal-fill columns that can never overflow — but all three fetched Card-container instances share template EL-d47874b2 with sizing `{horizontal: fixed, vertical: fixed}` at `{width: 280, height: 532}`, a genuinely fixed 280px column, and the root's own designedWidth (644px) is smaller than 3x280+2x16=872px of content — the overflow is deliberate, the entire reason this is a 'Carousel' and not a plain row. Fixed by having Carousel itself wrap each child in a `w-70 shrink-0` box (280px, confirmed in a real browser via Playwright against `pnpm ladle`, not just computed on paper) rather than changing CardContainer.tsx's own public shape (already merged, depended on elsewhere) — Figma puts the 280px on the instance inside this node, which is the argument for Carousel owning it.

## OPEN DESIGN QUESTION, flagged not resolved

the fetched node shows no scroll affordance at all (no arrows, no dots, no visible scrollbar) for the ~228px it deliberately pushes off-frame. `overflow-x-auto` (native browser scrollbar) is used as the least-invention stand-in — it adds no UI Figma doesn't show, unlike arrow/dot controls would — but it is this component's own addition, not sourced from the node, and needs a real design answer before this ships past a design-system preview. Verified end to end in a real browser: Default story (1136px-wide Ladle preview panel) renders three 280px columns with 16px gaps and does NOT overflow (872px content < 1136px container) — expected, since the row only overflows relative to whatever width its actual parent gives it; the ConstrainedToDesignedWidth story wraps the same three columns in a `w-161` (644px) box matching the fetched node's own designedWidth and reproduces the overflow exactly: scrollWidth 872px, clientWidth 644px, overflow 228px, visually ~2.3 columns visible with the third clipped at the frame edge — pixel-for-pixel the node's own arithmetic.

## SECOND CORRECTION post-review, same ticket (orchestrator caught it again, independently re-verifying in a browser)

the 280px-wrapper fix above stretched the wrapper to the tallest sibling (flex row default align-items:stretch) but never made CardContainer fill it, leaving columns with fewer cards ~122px of dead transparent space below their grey background — an internally inconsistent half-stretched/half-hugged state, visible as ragged column-bottom edges (measured before this fix: wrappers uniformly 280x296, but inner CardContainer 280x296 / 280x174 / 280x174). Resolved to EQUAL-HEIGHT columns: the wrapper now also forces its child to fill it (`[&>*]:h-full`), so CardContainer's own Content SLOT — already built fill/fill + justifyContent:center (node 3650:1297) — absorbs and centres the extra height, exactly the layout that slot was already designed for. No change to CardContainer.tsx.

## RESOLVED 2026-07-22 — columns HUG their own card count (equal-height rejected)

The equal-height reading above was the codebase's own extrapolation from the fetched node's uniform 4-card sample, flagged at the time as unresolved for the ragged case. The user has now answered it directly, reviewing #24 in Ladle: "de containers moeten om het aantal recepten heen wrappen" — columns must wrap/hug their own recipe count, not be forced to equal height. The equal-height behaviour was producing exactly the failure the open question predicted: with a ragged card count per column (Ontbijt 4 / Lunch 3 / Diner 2, once the story's card counts were fixed to match their `count` props), the 2nd and 3rd columns showed a tall grey background with the lone/few card(s) floating dead-centred in a lot of whitespace, instead of stopping right under their own last card.

Fixed in `Carousel.tsx`: removed the wrapper's forced fill (`[&>*]:h-full`) and the row's implicit `align-items: stretch` (added `items-start` to the row instead), so each `w-70 shrink-0` column wrapper now sizes to its own child's natural (hug) height. `CardContainer.tsx` needed no change — its Content SLOT's Figma-sourced `flex-1 justify-center` (fill/fill + justifyContent:center, node 3650:1297) simply has nothing to grow into once no ancestor forces extra height, so it's inert rather than in conflict.

Verified in a real browser (`pnpm ladle` + Playwright), Default story, 4/3/2-card columns (measured via `getBoundingClientRect`, both the `w-70 shrink-0` wrapper and its immediate `CardContainer` child):
- Ontbijt (4 cards): wrapper 280x540, inner 280x540 — top offset 32px
- Lunch (3 cards): wrapper 280x418, inner 280x418 — top offset 32px
- Diner (2 cards): wrapper 280x296, inner 280x296 — top offset 32px

Wrapper height == inner height for all three (zero dead space, down from the pre-fix 122px gap the equal-height version left on the shorter columns), the three heights strictly decrease with card count (540 > 418 > 296, a flat 122px per card — 2 cards per `Card` slot height), and all three columns share the identical top offset (32px), confirming top-alignment rather than the pre-fix vertical centring. Before/after screenshots taken both ways (stashed the fix, re-measured the un-fixed code, then restored it) reproduce the user's exact complaint pre-fix: Lunch/Diner showed one card floating dead-centre in a tall grey box; post-fix each column's grey background stops right under its own last card.

ConstrainedToDesignedWidth's overflow numbers (644/872/228, see below) are unaffected — column height and horizontal overflow are orthogonal, confirmed unchanged by this fix.

## `columnWidthClassName` prop added for #90 (BoardView) — the fixed 280px was never a Carousel constant

Re-measured the column width in all three nodes #90 fetched (`3680:1442` desktop-filled, `3680:1435` mobile-filled, `3878:10175` desktop-empty): every `Card-container` instance in the Te-Doen board is **320px** wide on desktop and **296px** on mobile — not the 280px this file's own wrapper (`w-70`) had hard-coded since #24. That 280 was always the *Recipe* screens' own instance override (`layout_d47874b2`, `{width:280,height:532}` on the originally fetched Card-container), not a property of `Carousel` itself; the master `Carousel` component (3670:1976) carries no width of its own; every screen fixes its own Card-container instance width, and Recipe (280) and Te-Doen (296/320) simply disagree. `Carousel.tsx` owning a single hard-coded number was therefore already wrong in principle, just invisible until a second consumer showed up.

Fixed by widening the constant into an optional prop, `columnWidthClassName`, defaulting to `"w-70"` — Recipe's own call sites (this file's stories, `CardContainer.stories.tsx`) pass nothing and are byte-for-byte unchanged (confirmed: their scoped baselines were not part of this ticket's regeneration). `BoardView.tsx` passes `"w-74 md:w-80"` (296px mobile-first, 320px at `md:`, same `w-<n>` = `n*0.25rem` Tailwind v4 dynamic-spacing form this file already used for `w-70`/`w-161`) — see design/notes/BoardView.md.

**Anomaly spotted, not fixed:** the Mobile/Filled node's own "Afgerond" column instance (`I3687:4016;3670:1765;3882:14251`) measures 320×564, not 296 wide like its three sibling columns in the same frame — looks like a Figma authoring slip (an un-adjusted duplicate of a desktop instance) rather than an intentional fourth width. Not corrected here since it's a single outlier inside the fetched data, not a pattern; flagged for whoever revisits mobile board fidelity.

The scroll-affordance open question above is **still open** — #90 re-checked all six Te-Doen screen variants and found nothing (no arrows/dots/scrollbar/fade), same as this file's original finding. Not resolved by this ticket either.

## Verified: horizontal scroll stays inside this component (issue 102, 2026-07-25)

No code change to this file — the ticket's actual defect risk (`main`/`body`
stretching to the board's full unscrolled width instead of `Carousel`'s own
row scrolling) lives one level up, in `main` missing `min-w-0`
(`AppShellNav.tsx`, see `design/notes/Sidebar.md`'s issue-101 entry for the
sibling change in the same file). Confirmed this file's own `overflow-x-auto`
row was never the problem: measured in a real browser (Playwright MCP, a
throwaway 6-column/8-card-per-column harness composing the real
`AppShellNav`/`PageHeader`/`BoardView`, deleted after use — `/te-doen` itself
needs a live Supabase session this dev machine can't provide) at 1440px —

| | `scrollWidth` | `clientWidth` |
|---|---|---|
| `document.body` | 1440 | 1440 |
| `main` | 1242 | 1242 |
| Carousel row (`.overflow-x-auto`) | 2000 | 1114 |

— and at 402px:

| | `scrollWidth` | `clientWidth` |
|---|---|---|
| `document.body` | 402 | 402 |
| `main` | 402 | 402 |
| Carousel row | 1856 | 386 |

`body`/`main` show zero overflow at both widths (`scrollWidth ===
clientWidth`); only the Carousel row itself overflows, exactly as designed.

## Issue #110 — hidden scrollbar, clip-at-sidebar (not padding), matching right margin

Three review-feedback points, all landing on this file's own root `div`
(the `overflow-x-auto` element) because `BoardView.tsx`/`TeDoenBoard.tsx`
aren't in this ticket's file-ownership scope — `BoardView` does forward its
own `className` straight to `Carousel`, but `TeDoenBoard.tsx` never passes
one today, so a call-site opt-in isn't reachable without editing a file
outside scope. All three fixes therefore live in this component's own
unconditional default, same call as point 1 below.

**1. Scrollbar hidden — component-level, not call-site.** `[scrollbar-
width:none] [&::-webkit-scrollbar]:hidden` on the scroll row. Per this
ticket's own instruction to reason about component vs. call-site (same
question issue #24's open scroll-affordance question already raised):
Recipes has no `Carousel` consumer yet (#28, deferred) and every fetched
Te-Doen/Recipe node still shows zero scroll affordance (see the open
question above), so there is no existing caller that wants a *visible*
scrollbar to diverge against — codebase-wide is both the design-consistent
answer and the only one reachable given the file-ownership constraint above.
Scrolling itself is untouched (wheel/trackpad/shift-scroll/touch never
depended on the scrollbar being visible); `tabIndex={0}` was added because a
bare `overflow-x-auto` div isn't reliably in the tab order across browsers,
and the ticket requires keyboard scroll to keep working — without it,
arrow-key scrolling only worked opportunistically depending on the browser.

**2 + 3. Left breakout past the caller's padding, right margin that survives
a full scroll.** Both fixed by moving from `w-full` to `-ml-4 pl-4 pr-4
md:-ml-32 md:pl-32 md:pr-32` on the same root `div`:

- The negative margin cancels `AppShellNav.tsx`'s `main` padding
  (`pl-4 md:pl-32`) for this element specifically, so Carousel's own box —
  the actual clip boundary `overflow-x-auto` clips against — reaches
  `main`'s true left edge (flush with the sidebar spacer) instead of
  stopping 16/128px short of it. That 16/128px gap was exactly the bug:
  columns scrolling left used to disappear at the padding edge, visibly
  short of the sidebar itself. `w-full` (fixed 100%) had to go for this to
  work — CSS's over-constrained rule silently reassigns `margin-right`
  instead of growing the box when width is a fixed percentage and both
  margins are non-auto; only an `auto`-resolved width (the default for a
  block box, and what flex `align-items: stretch` computes toward for a
  stretched item with no explicit width) actually widens on a negative
  margin. Verified this matters, not just reasoned: see measurements below.
- The `pl-*`/`pr-*` pair restores the pre-#110 visual card-start position
  on the left (net effect of `-ml-4`+`pl-4` inside an ancestor that itself
  has `pl-4` is a wash — see the Ladle-context note below) and, being new
  padding *inside* the scrolling box rather than outside it, adds a real
  margin after the last column that scrolls WITH the content — still
  visible after scrolling all the way right, not just at initial load,
  which is what the ticket's point 3 explicitly asked for over a plain
  outer `pr-*` on `main` (that would only ever show at rest).
- **No change needed in `AppShellNav.tsx` or `PageHeader.tsx`.** Both
  points 2 and 3 are fully absorbed by this component alone; `main` keeps
  its existing `pl-4 md:pl-32` (still correctly insets `PageHeader` and any
  other non-Carousel content in `main`, e.g. `TeDoenPageBody.tsx`'s
  empty-board fallback `<p>`, none of which this ticket owns or touches),
  and `PageHeader` keeps its own unchanged `pr-4 md:pr-32`.
- **Sidebar collapse/expand — no separate handling needed.** Carousel's box
  is defined purely relative to `main`'s own left edge (via the margin
  cancellation above), and `main` already tracks the sidebar's animated
  width through the existing flow-spacer (`AppShellNav.tsx`, `#101`). Since
  that relationship is recomputed by the browser every frame like any other
  flex layout, Carousel's clip boundary follows the sidebar in both
  collapsed/expanded states and through the transition with no extra code —
  confirmed in the browser checks below rather than assumed.

**Coupling flagged, not hidden:** `-ml-4 md:-ml-32`/`pl-4 md:pl-32` are
hardcoded to match `main`'s own `pl-4 md:pl-32` exactly — correct for every
current and only foreseeable caller (Recipes, once #28 lands, sits in the
same `AppShellNav` shell), but a future caller nesting `Carousel` inside a
container with *different* padding would get a wrong cancellation (either
under- or over-shooting the ancestor's real padding). No prop was added to
override it: nothing today would set it, and inventing an unused knob isn't
better than a documented, flagged coupling. Revisit if a second shell shape
ever appears.

**Ladle stories bleed slightly past Ladle's own decorator padding — checked
in a browser, not assumed away.** First measured algebraically as a "no-op"
(reasoning the story wrapper carries no ambient padding to cancel against),
that turned out wrong: Ladle's own preview chrome wraps every story in
`p-8`/`p-4` (32px), not zero, so `-ml-32`'s 128px overshoots it by 96px —
`carousel--default`'s row measured `x: -96` in a 1200px viewport (Playwright
`boundingBox()`), not `x: 32`. This is harmless, not a bug: negative margins
don't add to an ancestor's `scrollWidth` (confirmed `document.body.
scrollWidth === clientWidth`, no stray page-level scrollbar), and the
visible cards render at the *same* pixel position as before (the
compensating `pl-32` still lands at the same spot) — screenshotted both
stories and neither looks broken. The one real, expected effect: the row's
own scrollable viewport is ~128px wider than pre-#110, so
`ConstrainedToDesignedWidth` now shows slightly more of its third column
before the deliberate overflow clips it — a genuine baseline change, not a
regression, and exactly the same "coupled to `main`'s specific padding
value" trade-off flagged above, just visible in Ladle's smaller ambient
padding instead of being invisible there.

**Verified in a real browser** (Playwright MCP + `page.evaluate`/CDP against
`pnpm ladle`, `BoardView` composed inside a throwaway `AppShellNav`-shaped
harness — real `Sidebar`/`SIDEBAR_EXPANDED_WIDTH`/`SIDEBAR_COLLAPSED_WIDTH`/
`BoardView`, hand-built `main`/spacer markup byte-for-byte matching
`AppShellNav.tsx`'s own classes, since `AppShellNav` itself calls
`next/navigation` hooks that throw outside a real Next.js router and Ladle
has no such context — deleted before commit; `/te-doen` itself needs a live
Supabase session this machine doesn't have):

- 1440px, sidebar expanded: spacer `getBoundingClientRect()` = `{left: 32,
  right: 230, width: 198}` (the 32 is Ladle's own preview padding, not
  `main`'s — irrelevant to the relative check). Carousel row: `left: 230`
  (== spacer's right edge, confirming the box now starts flush at the
  sidebar) — not `358` (`230+128`), which is where the old padding-edge
  clip point would have been. First card's own left edge: `358` (`230+128`,
  the restored `pl-32` visual position, byte-identical to pre-#110).
  Scrolled to `scrollLeft = scrollWidth` (max), the gap between the row's
  own right edge and the last card's right edge measured exactly `128`px —
  the `pr-32` margin, still inside the scrollable box.
- Same checks at `collapsed=true`: spacer `{left: 32, right: 105, width:
  73}`; row `left: 105` (flush, not `233`); first card `left: 233`
  (`105+128`); trailing gap at max scroll `128`px again.
- 402px (mobile, `md:` sidebar spacer is `hidden` below that breakpoint so
  there's nothing to break out of): row flush with `main` at both edges;
  first card `left: 48` (`32+16`, the `pl-4` restored), trailing gap at max
  scroll `16`px (the `pr-4`) — same mechanism, mobile's smaller numbers.
- Collapse→expand transition: clicked the real toggle button, sampled
  `spacerRect.right - rowRect.left` every 25ms for 300ms while the spacer
  animated `198px → 73px` (intermediate widths `100.7`, `86.2`, `73.4`
  captured mid-transition). The difference was exactly `0` at **every**
  sample, including every intermediate frame — the row tracks the animating
  spacer with no lag, confirming no extra sync code was needed.
- Scrollbar hidden, `tabIndex` real, all four inputs, one session:
  `getComputedStyle(row, '::-webkit-scrollbar').display === 'none'` and
  `getComputedStyle(row).scrollbarWidth === 'none'` (Chromium supports both
  properties). `row.focus()` → `document.activeElement === row` (`tabIndex=
  {0}` actually lands it in tab order). Mouse wheel: hovering the row and
  calling `mouse.wheel(300, 0)` fired a `wheel` listener with `deltaX: 600`
  (Chromium's own 2x scroll-multiplier) and moved `scrollLeft` `0 → 300`.
  Shift+vertical wheel: `scrollLeft` `0 → 200`. Keyboard: two `ArrowRight`
  presses after focus moved `scrollLeft` `0 → 48.5`. Touch: Chromium's
  synthetic touch only produces real scrolling in a context created with
  `hasTouch: true` (a `browser.newContext()` isolate, not the default MCP
  page) — a CDP `Input.dispatchTouchEvent` swipe (touchStart/15×touchMove/
  touchEnd) there moved `scrollLeft` `0 → 963`.
- Drag-and-drop after horizontal scroll: set `scrollLeft = 900` (bringing
  columns 2/3 into view), then dragged "Card 2-0" onto "Card 3-0" with the
  same technique `design/notes/BoardView.md`'s own #90 verification used
  (`mouse.move`/`down`/15×`move`/`up`, not `locator.dragTo()` — dnd-kit's
  `PointerSensor` doesn't listen for native HTML5 drag events). Column 2's
  card list lost `Card 2-0`; Column 3's gained it as its new first item —
  confirms the negative-margin/padding change on the row's own box doesn't
  disturb `useDroppable`'s bounding-rect hit-testing on the columns/cards
  inside it, which read real-time `getBoundingClientRect()` regardless of
  how the row's position was produced.
- `carousel--default`/`carousel--constrained-to-designed-width` screenshotted
  after the change: both render correctly, no clipping/misalignment — see
  the Ladle-decorator-padding note just above for why their pixel content
  isn't byte-identical to the pre-#110 baseline.

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` on the fetched node
(3670:1976). Root `gap-4`→`gap-inline-lg`
(`itemSpacing`→`spacing/inline/gap-lg`, matches `Slot`'s own binding too).
`pl-4 md:pl-32`/`pr-4 md:pr-32` (the #110 bleed idiom above) →
`pl-page-left`/`pr-page-right-equal` — no node lookup needed here, per the
ticket's own page-padding rule (unambiguous 16/128 split, already in
`app/theme.css`'s `@media (min-width: 768px)` block). `-ml-4 md:-ml-32`
stays raw: it is a negative-margin bleed trick, not itself a page-padding
utility, and out of this ticket's explicit `pl-`/`pr-` scope.

**Comment-shrink pass (unrelated to the token swap itself):** this file was
already over `check:comment-budget`'s 30% cap on `main` (44.8%, pre-existing
— unaffected by this ticket's own edit, which was net-neutral on the
ratio). Since every fact in the three inline comment blocks (items-start/
overflow-x-auto/no-w-full reasoning, `-ml-*`/`pl-*`/`pr-*` bleed mechanics,
scrollbar hiding) already lives above in this file (#90/#110), the blocks
were reduced to a single pointer line each rather than duplicating that
record a second time in the component.
