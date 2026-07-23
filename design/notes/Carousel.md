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
