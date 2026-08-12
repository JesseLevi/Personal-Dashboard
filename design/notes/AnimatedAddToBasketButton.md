# Molecule/AnimatedAddToBasketButton

- **Code:** `components/molecules/AnimatedAddToBasketButton.tsx`
- **Node ID:** `4051:12960` ("AddToBasketAnimation" — a page-composition frame holding four `Button/Default` instances, not a real Figma component set; same `molecules_composed` precedent `design/figma-map.json` already uses for `ImageUploadField.tsx`).

Built #179 part 2. Fetched via `get_figma_data` (geometry) and the REST `nodes?ids=` endpoint (annotations — `get_figma_data` drops them). Four annotated instances: `4051:12888` (labelled, "as seen in ReceptDetailPage"), `4051:12962` (icon-only, "as seen in ingredient component"), `4051:12939`/`4051:12975` (their respective "Added" companions) — all four: *"On click add items to basket + animate button to AddToBaskt Added button"* / *"Text + icon slide in from bottom while AddtoBasket text + button slide out of view to top. Also add small scale effect when clicking."*

## Two call sites, one component

`RecipeDetailPage.tsx`'s header `ShoppingBasket` button (labelled: `label`/`addedLabel`) and `CardContentIngredient`'s swipe-revealed cart button (icon-only: `aria-label` alone) — same discriminated union idiom `Button`'s own icon-only branch uses. Both compose the same underlying mechanism; `Button` itself is untouched (stays a presentational Server Component, per `CLAUDE.md`) — this molecule owns click/timer state and passes its own sliding composite as `Button`'s `children`, never as `Button`'s `icon` prop (see "Why not two stacked Buttons" below).

## Icon-only "Added" face — annotation overrides a Figma geometry artifact

`4051:12975`'s own annotation reads *"...(icon only)"*, but its fetched geometry (`4051:12983`, template `EL-93f9f305`) still carries a Text child ("Toegevoegd", inherited from the labelled variant's template, width 128) — a copy-paste leftover, not a real Text override (same class of Figma authoring artifact as `WinkelmandPage.md`'s "Mobile node text mismatch" entry). Built per the annotation's explicit words, not the stray geometry: the icon-only face never renders label text in either state, only the labelled face does. Flagged here, not silently reconciled.

## Mechanism — one `Button`, a sliding composite as its `children`

Passing `icon`/`children` to `Button` normally is a static, single frame. To animate between two frames (rest/"added") *inside* one `Button` instance, this component builds its own two-layer composite and hands it to `Button` as `children` (with `icon` left unset) — it renders entirely inside `Button`'s own `<span className="flex items-center gap-2">{children}</span>` wrapper, so `Button.tsx` needed zero changes:

```
<span className="relative inline-grid h-6 overflow-hidden">
  <Face icon="ShoppingBasket" label={label} hidden={added} />   {/* col-start-1 row-start-1 */}
  <Face icon="Check" label={addedLabel} hidden={!added} />      {/* col-start-1 row-start-1 */}
</span>
```
Both `Face`s share one CSS Grid cell (`inline-grid`, both `col-start-1 row-start-1`) — the standard "stacked overlay" trick, sized to the *wider* of the two by Grid's own intrinsic sizing, no JS width measurement needed even though "Voeg toe aan mand"/"Toegevoegd" differ in length. `translate-y-full`/`-translate-y-full`/`translate-y-0` (Tailwind's own transform utilities) slide each face out to the top / in from the bottom, `duration-[var(--duration-base)] ease-base` (existing tokens, no new magic numbers) and `motion-reduce:transition-none` (same precedent `Dropdown.tsx` already sets for its own chevron rotation/panel collapse).

### Why not two stacked `Button`s

An earlier design considered rendering two full `Button` elements (one per face, absolutely stacked, only one interactive) — closer to the four separate Figma frames literally. Rejected: two sibling `<button>`s standing in for one visual control is an accessibility smell (focus order, which one "is" the control), and the icon-only footprint would need `Button`'s internal `iconOnlyDefault` sizing to fire on **both** stacked instances independently, doubling the coupling to `Button`'s private sizing logic for no real benefit. The single-`Button`-with-composite-children approach avoids both problems and incidentally reproduces the exact 40×40 icon-only footprint for free (see below).

### Icon-only footprint — 40×40 without touching `Button`'s `iconOnlyDefault`

Passing `children` (even icon-only content) always routes through `Button`'s **labelled** branch (`h-10 px-2 justify-center`, since `align` defaults to `center` → `justify-center`, #112), never its `iconOnlyDefault` (`size-10`) branch — that branch requires `children` to be absent. This isn't a problem here: the icon-only composite's only content is a single 24px `Icon`, so `px-2` (8px) + 24px + `px-2` (8px) = 40px width, `h-10` = 40px height — the exact same 40×40 `Button.md` #75 established for `iconOnlyDefault`, arrived at via a different but equally-stated arithmetic path. Confirmed this is exactly `REVEAL_PX`-compatible with `CardContentIngredient`'s existing swipe math (`design/notes/CardContentIngredient.md`) — no change needed there.

## Press-scale — `transition-all!` overrides `Button`'s own `transition-colors`

`Button`'s base class already sets `transition-colors`; adding a second, plain `transition-transform` (for the "small scale effect") would stack two utilities that both set the single non-additive `transition-property` CSS property — the winner would then depend on Tailwind's own internal utility-emission order, not source order (the exact landmine `Button.md`'s own header already flags for a different property). Fixed with `transition-all!` (Tailwind's `!` important-modifier, same technique `ButtonToggle.tsx` already uses for its own Transparent-fill override) so this instance's transition list wins deterministically regardless of stylesheet order, paired with the same `duration-[var(--duration-base)] ease-base` tokens and `motion-reduce:transition-none!`/`motion-reduce:active:scale-100` (press-scale also respects reduced motion).

## Judgement calls (not specified by Figma/the ticket — recorded per instruction)

1. **"Added" state persists 2s, then reverts.** Not sourced from Figma (the annotation describes the transition, not its lifetime) — a code-side pick, long enough to register as a real affirmation, short enough not to block a user who wants to add a second item right after. A `setTimeout`, cleared and re-armed on every click (so rapid re-clicks don't revert early) and cleared on unmount.
2. **The animation plays optimistically, decoupled from the actual server result.** Neither call site inspects the awaited action's `ActionResult` before/after playing "Toegevoegd" — a failed `sendRecipeToShoppingList`/`addIngredientToShoppingList` still shows the affirmation and reverts on the same timer. This matches the already-accepted, already-documented gap `docs/open-questions.md#winkelmand-send-no-success-feedback` (no success/failure feedback exists for the bulk send path either) rather than inventing new failure UI this ticket doesn't ask for. A future ticket that builds real feedback for that gap should revisit this component too, not just the bulk path.
3. **Icon-only mode's `aria-label` stays constant across the animation** — it doesn't switch to announcing "Added" the way the labelled face's visible text does. A screen-reader user gets no explicit "item added" announcement from the icon-only swipe button today (only the always-true `aria-label` describing the action). Flagged, not solved — an `aria-live` region would be the real fix, out of scope for this ticket's animation ask.

## Ladle

`Labelled`/`IconOnly`/`NlCatalog`/`Disabled` — `AnimatedAddToBasketButton.stories.tsx`. The animation itself (a live state transition) isn't captured by the static screenshot baseline, same precedent as `CardContentIngredient`'s Active pill and swipe stories — every story renders the resting (pre-click) frame only.

## Verification

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget`/`test:visual` (full suite, twice) all run clean. Verified live against the real hosted Supabase project (Playwright, `pnpm dev`, `/recepten/[recipeId]`, throwaway test user, deleted afterward): both the labelled header instance and the icon-only swipe-revealed instance correctly swap `Face`s on click (`aria-hidden` flips, classes swap between `translate-y-0`/`-translate-y-full`/`translate-y-full`) and revert on their own — measured against the then-current 1.5s timer, raised to 2s afterwards on user request without a fresh live run; `prefers-reduced-motion` (real `page.emulateMedia`, not a class toggle) makes `getComputedStyle(...).transitionProperty` read `"none"` on both `Face`s and the `Button` root. Full detail, including the one pre-existing hosted-schema gap this surfaced (unrelated to this component): `design/notes/RecipeDetailPage.md`'s own #179 part 2 entry.

## TICKET #205 (2026-08-12): spacing token

`Face`'s own `gap-2`→`gap-inline-sm`. Measured via `figma_execute`/
`boundVariables` on the fetched frame (4051:12960): most of its "Leading +
Text" children bind `spacing/inline/gap-sm` (a few sibling frames in the
same animation set show no binding at all — an artifact of Figma's
duplicate-for-each-animation-frame authoring, not a real divergence), and
this token already matches `Atom/Button`'s own "Leading + Text" binding
that `Face` recreates for the slide animation. No radius/other padding
classes on this file — `Button` supplies its own chrome untouched.
