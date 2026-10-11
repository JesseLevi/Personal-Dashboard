# Card-content/Ingredient
Figma: `Card-content/Ingredient` component set · node `3727:4021` (Default `3626:4552`/`3727:4309`/`3727:4022`, Active `3727:4290`, Delete `3727:4378`, Cart `4050:11613`) · Code: `components/molecules/CardContentIngredient.tsx`

## Anatomy
Row: name (`text-base font-semibold text-text-primary`), optional neutral `Tag` (quantity), optional `Checkbox`, optional bottom divider. Figma axes:
- Checkbox (None/Unchecked/Checked) -> optional `checked` (omit for None). `checked` also dims name and Tag to `opacity-40`. The Checkbox's accessible name is the ingredient `name` (dynamic content, no i18n entry).
- `Tag` boolean -> optional `quantity`; Tag renders only when supplied.
- State axis is not a CVA prop. `Default` is the plain row. `Active` (pressed pill) was removed. `Delete` and `Cart` are one drag gesture revealing an action, behind the opt-in discriminated union `swipeAction: "delete" | "cart"` (handler and label required together with it).
- `divider` -> an `h-px bg-stroke-lines` sibling below the row. The caller passes `index < rows.length - 1`: the component cannot see its siblings.
- Row chrome: `gap-inline-xl rounded-container pl/py-component-md`, `pr-component-md` (`pr-component-lg` while swiped open).
- Optional `reviewLabel` (+ `onReviewClick` makes it a button): `Tag variant="highlight"` under the name ("controleren" for an imported line with `needs_review`, or "niet meegeteld" for a line the nutrition totals leave out; see `design/notes/RecipeDetailPage.md`). Claude-designed on request, existing Tag only. (#318) Stories `NeedsReview`, `NotCounted`.

## Deliberate decisions
- No pointer-state fill at all: the `State=Active` press fill and padding shift were removed on user instruction ("hover/active animaties mogen eruit"); the node defines no Hover state either. (#166)
- Divider is its own unrounded sibling, never `border-b` on the `rounded-container` row: a lone bottom border on a rounded box curves into both corners. `className` sits on the outer `flex-col` wrapper. Divider sits between rows, none after the last (Figma dropped the per-row stroke). It stays a prop here, not `divide-y` on `Card`, because `Card` is shared by other content types and `IngredientSearchPanel`'s zero-results branch has non-row children. (#166, #160)
- Swipe is component state, not a CSS pseudo-class: a live drag offset and an open/closed snap cannot be expressed by a selector, so the file carries `"use client"`. Opt-in only; there is no always-visible Delete pill (the annotation "When sliding" describes what a swipe reveals). (#160)
- `swipeAction: "cart"` (first consumer: recipe detail ingredient rows) reveals `AnimatedAddToBasketButton`, not a destructive Trash. The fetched Cart node uses a Filled Button (`3623:4344`, `surface-raised`) with `Icon/Shopping-basket`, whereas Delete uses Destructive (`3693:3386`). `swipeToDelete` was renamed, not kept. (#179)
- Two elements translate in lockstep inside one `overflow-hidden rounded-container` wrapper: the content row (`translateX(offset)`, `offset` in `[-REVEAL_PX, 0]`) and the revealed button (`translateX(offset + REVEAL_PX)`). Pinning the button at a static `right-0` made its fill bleed through the transparent resting row. `REVEAL_PX = 48` is the 40px button footprint plus the node's 8px gap (both revealed buttons are 40x40); `OPEN_THRESHOLD_PX` is half of that. (#160, #179)
- The inline `style={{ transform }}` (two places) is a deliberate exception to "utilities only": a live pixel offset has no utility class. (#160)
- Keyboard: the revealed button is always tabbable, and `onFocus`/`onBlur` set/clear `open`, so Tab reveals the row like a drag. Accepted trade-off: the button wrapper is the row's first child (needed for stacking beneath the content), so Tab reaches the button before the Checkbox, reversed from visual order. Reordering the DOM would disturb the stacking fix above. (#177)
- `handlePointerMove` returns early unless a `dragging` ref is set on pointerdown: a desktop mouse fires `pointermove` on plain hover with a stale `dragStartX`, which slid the row. Refs (`dragging`, `captured`, `dragStartX`) rather than state, since they are read synchronously inside the handlers. (#179)
- Pointer capture is taken lazily, only once movement crosses `TAP_SLOP_PX` (4px), not on pointerdown: eager capture retargets the subsequent `click` to the row div and swallowed every desktop click on the nested Checkbox/Trash button. Releasing capture on pointerup was measured not to work (Chromium already retargeted the click). Touch has implicit capture on the real target and is unaffected; tap below the slop closes an open row. Tested with trusted CDP touch events (synthetic `PointerEvent`s throw on `setPointerCapture`). (#222)
- Tag does not wrap under a long name: the Tag has `shrink-0` and the name `<p>` has `min-w-0`, so the name wraps instead. Fixed here, not in `Atom/Tag`, because other Tag consumers stack the Tag below the text and never share a horizontal flex row. Story `LongNameWrap`. (#222)
- Longhand padding (`pl-`, `pr-`, `py-`), never `px-*`: the shorthand emits `padding-inline`, a different declaration from `padding-right`, so the open state's `pr-component-lg` override could lose on utility emission order.
- Delete/Trash footprint archaeology: `design/notes/Button.md` (#75). The Checkbox and Button atoms carry `shrink-0` themselves (#80), so no protection is needed here.

## Token gaps and flags
- Tokens measured via `boundVariables` across every state: row gap 20px -> `gap-inline-xl` (`spacing/inline/gap-xl`); padding 12px -> `*-component-md` (`spacing/component/padding-md`); swiped-open right padding 16px -> `pr-component-lg` (Active binds `padding-lg` on `paddingRight` only); radius 24px -> `rounded-container` (`radius/container`, byte-identical to the old `rounded-3xl`). The static Default sample has no radius; the code applies `rounded-container` to every branch regardless. (#205)
- Neutral `Tag` is an exact match for the fetched nested Tag (`#F5F5F4`/`#79716B` = `surface-muted`/`text-muted`). (#20)
- Left unbound: "Ingredient + quantity" 80px item spacing (unbound in Figma; `justify-between` handles it in code); `Tag`'s `spacing/mini` gap belongs to `design/notes/Tag.md`. (#205)

## Gotchas
- The Figma search-panel node draws no checked-row example; `IngredientSearchPanel.stories` `SomeRowsChecked` reuses the Checked styling built for the recipe detail screen.
- The Delete pill is not a static state any more; stories `SwipeToDelete`/`SwipeToCart` show the resting (closed) state, which is what the baselines capture.

## Open
- `docs/open-questions.md#no-pointer-affordance` (no Hover state is designed for this row).
