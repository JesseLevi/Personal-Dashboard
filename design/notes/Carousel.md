# Carousel
Figma: `Carousel` · node `3670:1976` · Code: `components/organisms/Carousel.tsx`

## Anatomy
Single COMPONENT, no variant axis, no fill, so no CVA. Figma root (row, gap 16) wraps one SLOT `Slot` (row, gap 16) -> required `children`; both render identically once nested, so they collapse into one scrolling `div`. The Figma example nests three `Card-container` instances (not bare `Card`). Presentational only: which columns render and their counts are composer-supplied. No strings of its own (#24).

Each child is wrapped in a `shrink-0` box of `columnWidthClassName` (default `w-70` = 280px). The row is `flex items-start gap-inline-lg overflow-x-auto -ml-4 md:-ml-32 pl-page-left pr-page-right-equal` with a hidden scrollbar and `tabIndex={0}`. Exports `BOARD_COLUMN_WIDTH = "w-74 md:w-80"` (296 mobile / 320 desktop), shared by `BoardView` and the board loading skeleton (`design/notes/Skeletons.md`) so they cannot drift.

## Deliberate decisions
- Carousel owns the column width (wrapper `shrink-0`) rather than changing `CardContainer`'s public shape. Figma fixes 280px on the instance inside this node, and the example overflows on purpose (3x280 + 2x16 = 872 vs designed width 644); that overflow is the reason this is a carousel and not a plain row (#24).
- Columns hug their own card count: `items-start` on the row, no forced `h-full` on the wrappers. Equal-height columns were tried first (extrapolated from the 4-card sample) and rejected by the user ("de containers moeten om het aantal recepten heen wrappen"): ragged counts (4/3/2) showed tall grey columns with cards floating in the middle. `CardContainer`'s `flex-1 justify-center` Content slot is then inert, which is fine; do not re-add stretch (#24).
- `columnWidthClassName` prop: the 280px was never a Carousel constant. It was the Recipe screens' instance override, while every Te-Doen board `Card-container` is 320px desktop / 296px mobile (nodes `3680:1442`, `3680:1435`, `3878:10175`). Default stays `w-70`, so Recipe call sites are unchanged; `BoardView` passes `BOARD_COLUMN_WIDTH` (#90).
- `overflow-x-auto` is the least-invention scroll mechanism: the node shows no affordance (no arrows, dots, scrollbar or fade), re-checked across all six Te-Doen variants (#24, #90).
- Scrollbar hidden component-wide (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`): no caller wants a visible one and the file-ownership constraint of that ticket allowed no call-site opt-in. Wheel, shift-wheel, touch and keyboard scrolling are unaffected. `tabIndex={0}` is required because a bare `overflow-x-auto` div is not reliably in the tab order, and arrow-key scrolling would only work opportunistically (#110).
- Left breakout: `-ml-4 md:-ml-32` cancels `main`'s `pl-page-left` so the row's box (the actual clip edge) reaches the sidebar edge; columns scrolling left used to vanish at the padding edge, visibly short of the sidebar. `pl-page-left` restores the first card's visual position. `pr-page-right-equal` is padding inside the scrolling box, so the end-of-scroll margin scrolls with the content and is still visible after scrolling fully right (a plain outer `pr` on `main` would only show at rest). No change needed in `AppShellNav` or `PageHeader` (#110).
- No `w-full` on the row: with a fixed percentage width and both margins non-auto, CSS's over-constrained rule reassigns `margin-right` instead of growing the box, so the negative margin would do nothing. Only an auto-resolved width widens (#110).
- Sidebar collapse/expand needs no handling: the row's box is defined relative to `main`'s left edge, and `main` follows the animated sidebar spacer every frame (measured: zero lag mid-transition) (#110).
- Tokens: root gap `gap-inline-lg` (`spacing/inline/gap-lg`, also `Slot`'s binding), and the page-padding tokens `pl-page-left` / `pr-page-right-equal` replace `pl-4 md:pl-32` / `pr-4 md:pr-32` (#205).

## Token gaps and flags
- `-ml-4 md:-ml-32` stays raw: it is a negative-margin bleed trick, not a page-padding utility (#205).
- The bleed is coupled to `main`'s `pl-page-left` (16 / 128). A caller nesting `Carousel` in a container with different padding would get a wrong cancellation. No override prop was added because nothing would set it; revisit if a second shell shape appears (#110).
- Figma anomaly, not fixed: the Mobile/Filled "Afgerond" column (`I3687:4016;3670:1765;3882:14251`) measures 320x564, unlike its 296px siblings, likely an un-adjusted desktop duplicate (#90).

## Gotchas
- Horizontal overflow must stay inside the row. If `body` or `main` start growing to the board's full width, the cause is `main` missing `min-w-0` in `AppShellNav` (see `design/notes/Sidebar.md` issue-101 entry), not this file. Verified: only the Carousel row overflows (e.g. 2000 vs 1114 at 1440px) (#102).
- Ladle stories sit inside Ladle's own 32px decorator padding, so `-ml-32` overshoots it and the row renders at a negative x. Harmless (negative margins add no `scrollWidth`; cards land at the same pixel position), but `ConstrainedToDesignedWidth` (644px box, overflow 872 vs 644 = 228px) now shows slightly more of the third column than before the bleed (#110).
- Drag-and-drop between columns after horizontal scroll still works (dnd-kit reads real-time rects); `BoardView` is the consumer (`design/notes/BoardView.md`).

## Open
- Scroll affordance for the deliberately clipped overflow is undecided (no `docs/open-questions.md` slug exists for it); `overflow-x-auto` with a hidden scrollbar is the stand-in.
