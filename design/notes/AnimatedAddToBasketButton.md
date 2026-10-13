# AnimatedAddToBasketButton
Figma: "AddToBasketAnimation" · node `4051:12960` (a page-composition frame of four `Button/Default` instances, not a real component set; same `molecules_composed` precedent as `ImageUploadField.tsx` in `design/figma-map.json`) · Code: `components/molecules/AnimatedAddToBasketButton.tsx`

## Anatomy
Composes `Button` (stays a presentational Server Component) with its own click and timer state. On click the resting icon+label slides out to the top while the "Added" icon+label slides in from the bottom, plus a small press-scale. Two call sites: `RecipeDetailPage` header (labelled: `label` + `addedLabel`) and `CardContentIngredient`'s swipe-revealed cart button (icon-only: `aria-label` alone). The props are a discriminated union, the same idiom as `Button`'s icon-only branch. The four annotated Figma instances are `4051:12888` (labelled), `4051:12962` (icon-only) and their "Added" companions `4051:12939` / `4051:12975` (#179).

## Deliberate decisions
- One `Button`, a sliding composite as its `children` (`icon` left unset): two `Face`s stacked in one CSS Grid cell (`inline-grid`, both `col-start-1 row-start-1`, `h-6 overflow-hidden`). Grid sizes to the wider face, so no JS width measurement. Faces slide with `translate-y-*` using `--duration-base` / `ease-base`, and `motion-reduce:transition-none`. `Button.tsx` needed zero changes (#179).
- Rejected: two stacked `Button` elements. Two sibling `<button>`s for one control is an a11y smell (focus order) and doubles the coupling to `Button`'s private icon-only sizing (#179).
- Icon-only footprint is 40x40 without `iconOnlyDefault`: passing `children` routes through `Button`'s labelled branch (`h-10 px-2`), and one 24px icon plus `px-2` each side is 40 wide. This matches `CardContentIngredient`'s `REVEAL_PX` swipe math (`design/notes/CardContentIngredient.md`), so no change there (#179).
- The icon-only "Added" face never renders label text. The annotation on `4051:12975` says icon only; its geometry (`4051:12983`) still carries a "Toegevoegd" text child inherited from the labelled template, a copy-paste artifact. The annotation wins (#179).
- Press-scale uses `transition-all!` (important modifier, as `ButtonToggle.tsx` does) because `Button`'s base `transition-colors` and a second `transition-*` utility both set the non-additive `transition-property`, and the winner would depend on Tailwind's emission order. Paired with `motion-reduce:transition-none!` and `motion-reduce:active:scale-100` (#179).
- The "Added" state lasts 2s (`REVERT_MS`), then reverts. Not from Figma (the annotation gives the transition, not its lifetime); a code-side pick. One `setTimeout`, cleared and re-armed on every click and cleared on unmount (#179).
- The animation plays only on a successful result. `onAddToBasket` returns `Promise<ActionResult>`; `lib/ui/add-to-basket.ts#playsAddedFace` awaits it and the Added face plays only on `success: true`. A failure leaves the button at rest, with no error UI because none is designed. While pending the button stays on its rest face (no spinner), so a success has one server round-trip of delay before the slide. Clicks while a call is in flight are ignored via a ref guard so a double-click cannot insert twice. The decision lives in a pure helper because the repo has no DOM test stack (`tests/add-to-basket.test.ts`) (#290).
- Optional `shortLabel` (labelled mode only) replaces `label` below `md`; the recipe header uses it for "Voeg toe" / "Add" on mobile. Not in Figma.
- Basket popover (#429, not in Figma): `baskets` with more than one entry turns the click into a toggle for a labelless `Dropdown` of white `Button`s, one per basket, icon `Users` when shared, else `User`. The animation runs only after a choice and the send, with the id passed as `onAddToBasket(listId)`. Zero or one basket: unchanged, `onAddToBasket()` without argument. The popover is portalled to `body` with `usePopoverPosition` `strategy: "fixed"`, because the icon-only button sits in `CardContentIngredient`'s `overflow-hidden` swipe row. A pointer down outside trigger and popover closes it (as Sorteer). Choosing hands focus back to the trigger so the swipe row stays open. `defaultChoosing` is story-only.

## Token gaps and flags
- `Face` `gap-inline-sm`: read via `boundVariables` on `4051:12960` (`spacing/inline/gap-sm`), matching `Button`'s own "Leading + Text" binding. A few sibling frames in the animation set show no binding, an artifact of per-frame duplication, not a real divergence (#205).

## Gotchas
- Icon-only mode's `aria-label` stays constant across the animation; a screen-reader user gets no "item added" announcement. An `aria-live` region would be the real fix, not built.
- Ladle stories (`Labelled`, `IconOnly`, `NlCatalog`, `Disabled`, `AddSucceeds`, `AddFails`) render the resting frame only; `BasketPopoverTwo`, `BasketPopoverThree` and `BasketPopoverIconOnly` capture the open popover; the live transition and the failure path are not captured by the static visual baseline.

## Open
- `docs/open-questions.md#winkelmand-send-no-success-feedback`
