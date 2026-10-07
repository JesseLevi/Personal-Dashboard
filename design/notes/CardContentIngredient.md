# Card-content/Ingredient

- **Code:** `components/molecules/CardContentIngredient.tsx`
- **Node ID:** `3727:4021`

Built #20, fixed #67 2026-07-21 (re-fetch found only Default/Active/Delete — no Hover). Component set, two axes: Checkbox (None/Unchecked/Checked) and State (Default/Active/Delete). Checkbox axis -> optional `checked` prop (omit for Checkbox=None); Checked=true also dims name+tag to opacity-40, matching the fetched frame. State axis is NOT a CVA prop (CLAUDE.md: State -> CSS pseudo-classes): since the node has no Hover frame, Active's stone-200/surface-raised pill (rounded 24px literal from the node -> rounded-3xl) + 4px extra right padding is modelled as `active:` only (Figma's Active = currently being pressed, same precedent as #56/#58), not hover:/focus-within: (that was #20's bug, fixed in #67). Delete (re-verified against node 3727:4378) is NOT the same pointer-state pill: its `Molecule/Ingredient` frame (fills stone-200/surface-raised, radius 24px, padding 12px 16px 12px 12px) is unconditional/always-on, and the destructive icon-only Trash Button (Atom/Button, variant=destructive icon-only default) is a sibling OUTSIDE that frame in an outer justify-content:flex-end row (gap 8) — #20 had wrongly nested the button inside the hover-only pill. `onDelete` requires a caller-supplied `deleteLabel` (icon-only aria-label, same discriminated-union idiom as Button/ButtonToggle) sourced from messages/*.json `components.cardContentIngredient.deleteLabel` in the Ladle story, never hardcoded in the component. Tag reuse (variant=neutral) is an exact token match for the fetched nested Tag instance (#F5F5F4/#79716B == surface-muted/text-muted), no gap. Open question: node defines no Hover state at all (docs/open-questions.md#no-pointer-affordance) — an ingredient row has no mouse-over affordance, only a press affordance; same class of gap already recorded there for Atom/Button's Transparent style.

## TICKET #80 (2026-07-21)

the Checkbox and Trash Button rendered inside this molecule's rows are flex children of `flex w-full ...` containers with no shrink protection of their own, so the browser was free to compress their stated widths (verified with Playwright against `pnpm ladle`: Checkbox down to 27.5x32, Trash Button down to 35.1x40, height held fixed by h-8/h-10) — the same emergent-vs-structural failure class #69/#75 already named, arriving via flex-shrink instead of padding arithmetic. Fixed at the atoms (`shrink-0` added to Checkbox's and Button's own base classes, see their notes above), not here — this molecule needed no change of its own; both its Checkbox/Button call sites now render at their stated square footprint unconditionally.

## Additional facts (moved from the component doc comment, comment-shrink pass)

- Checkbox atom's accessible name is the ingredient's own `name` (dynamic content, not chrome UI text, so no next-intl entry is needed for it — same reasoning Card.tsx applies to its own dynamic props).
- Padding uses explicit longhand (`pl-3 pr-3 py-3`, never the `px-3` shorthand) because `px-*` emits `padding-inline`, a different longhand from `pr-*`'s `padding-right` — both affect the right side in LTR, but as two distinct declarations the winner would be decided by Tailwind's utility emission order, not by one overriding the other. Using `pr-3` in the base means the `:active` variant's `pr-4` overrides the identical longhand property. `Atom/Button`'s own doc comment flags the general version of this fragility (`h-8`/`h-10` on the same property, same specificity); splitting the shorthand here is the same defensive move applied to padding. `transition-colors` only animates colour, not padding/spacing, so the row visibly shifts 4px the instant `:active` fires rather than easing — that shift is in the fetched node (the padding literally changes), so it is kept deliberately, not smoothed away.
- Text style: `text-base/semibold` (Figma) -> `text-base font-semibold` (design/tokens.json typography map). Name fill stone-950 -> `text-text`.
- Trash Button footprint archaeology (root padding 8/24/4 = 40x40, atom bug, fix) is recorded in `design/notes/Button.md` ticket #75 — not duplicated here.

## TICKET #131 (2026-08-01) — `quantity` optional, `divider` added

Fresh fetch of `3727:4309` (via the ingredient-search-panel node, `IngredientSearchPanel.md`) found two instance properties this atom didn't model, both applied consistently across every row in that usage:

- `componentProperties: {"Tag": false}` — the quantity chip is a real, hideable Figma boolean, not always-on. `quantity` changed from required to optional; the `Tag` only renders when supplied. No existing call site passes `quantity: undefined`, so every current rendering is byte-identical.
- `strokes: #E7E5E4` bottom-only (1px) on every row template, including the last — a per-row list divider with no last-child exception in the source. `#E7E5E4` == `border-muted` exactly (`design/tokens.json`), no token gap. New optional `divider?: boolean` prop, default `false` (every pre-#131 call site unaffected).

Full reasoning for why these are real Figma findings and not codebase guesses lives in `IngredientSearchPanel.md`, not duplicated here.

## TICKET #160 part 1 (2026-08-05/06) — divider rework + iOS swipe-to-delete

Re-fetched `3727:4021` via `get_figma_data` (geometry) and the REST `nodes?ids=` endpoint (annotations — MCP drops them, per `docs/guides/ui-components.md`). Two confirmed annotations on the set: `State=Active, Checkbox=Unchecked` → "When pressing"; `State=Delete, Checkbox=Unchecked / Molecule/Ingredient` → "When sliding". Geometry confirms #131's stroke is gone: none of the four row templates in this fetch carry a `strokes` property at all (previously bottom-only `#E7E5E4` on every row including the last).

**Divider ownership.** Figma now draws the rule *between* rows — none above the first, none below the last. Two places could own "which rows get it": `Card.tsx` (the shared list wrapper via e.g. `divide-y`) or this component with a caller-supplied per-row signal. Chose the latter: `divider` stays a prop on this component, but its meaning changes from "always render" (#131) to "render unless this is the list's last row" — every call site already `.map()`s its rows, so each now passes `divider={index < rows.length - 1}` instead of a bare `divider`. Rejected `Card.tsx` owning it via `divide-y divide-border-muted` on its content wrapper: `Card` is shared by `CardContentRecipe`/`Ticket`/`Step` too, none of which want row dividers, and `IngredientSearchPanel.tsx`'s zero-results branch renders a `<p>` and a hand-built row as `Card`'s two direct children — a `divide-y` there would draw an unintended rule between them that has nothing to do with ingredient rows. Keeping the rule inside this component (which already owns its own border/padding/background per row) avoids that blast radius entirely. Updated every call site: `RecipeDetailPage.tsx`, `IngredientSearchPanel.tsx`, `StepIngredientPanel.tsx`, `Card.stories.tsx`, `CardContentIngredient.stories.tsx`.

**Swipe-to-delete.** The always-on Delete pill (#20/#67's reading) was wrong for #160: the annotation says "When sliding" — it's what a swipe *reveals*, not a persistent state. Rebuilt behind an explicit opt-in `swipeToDelete: true` (user decision), required together with `onDelete`/`deleteLabel` in the discriminated union — there is no longer any code path that renders the Delete pill unconditionally. No app call site sets it today (recipe ingredients stay non-deletable); the only planned consumer is the Phase 5 shopping basket (#29), so it's exercised by a Ladle story (`SwipeToDelete`) only.

Why this is component state, not a CSS pseudo-class, despite the guide's "State axis → CSS pseudo-class" rule: that rule covers states a stylesheet can express (`:hover`/`:active`/`aria-pressed`). A live drag offset and an open/closed snap threshold cannot be — there is no CSS selector for "dragged past 24px". This makes it real interaction state, same category as `Dropdown` owning its open state, and it is why the component now carries `"use client"` (it did not before #160; every previous variant was stateless/presentational).

Geometry: `REVEAL_PX = 48` = the Trash Button's own 40px footprint (`Button.md` #75 archaeology) + the fetched node's 8px gap between the pill and the button. The open pill's padding (`py-3 pl-3 pr-4`) reuses the exact literal from the fetched `State=Delete` frame (`12px 16px 12px 12px`), matching the existing `:active` row's `pr-4` precedent.

Implementation shape: two elements translate in lockstep inside one `overflow-hidden` wrapper — the content row (`translateX(offset)`, `offset` ∈ `[-REVEAL_PX, 0]`) and the Trash Button (`translateX(offset + REVEAL_PX)`, resting flush past the right edge at `offset = 0` and sliding to `right:0` at full open). **Bug found and fixed during this ticket**: an earlier version pinned the button at a static `right-0` and only translated the content — since the content row has no background at rest (transparent, matching the Default row), the button's own red fill bled through visibly at the row's right edge even when fully closed (caught by reviewing the regenerated `card-content-ingredient--swipe-to-delete` baseline PNG, not by reasoning alone). Giving the button the same lockstep translation fixed it: verified in the regenerated baseline, no bleed-through at rest.

Inline `style={{ transform: ... }}` (two places) is a deliberate, narrow exception to "Tailwind utilities only in components/": a live pixel offset during an active drag has no static utility class to express it — this is runtime interaction state, not a design token or a hardcoded value that should have been a token. No raw hex or spacing token is bypassed by it.

Flagged, not fixed: the swipe reveal has no keyboard-only path today — `tabIndex={-1}`/`aria-hidden` keep the Trash button out of tab order while closed (so a keyboard user can't tab onto an invisible control), but nothing currently lets a keyboard-only user *open* the row to reach it at all. Figma defines no such affordance either. Same class of gap as `docs/open-questions.md#no-pointer-affordance` (an interaction the fetched node simply doesn't design for) — worth a real fix once the shopping basket (#29) actually ships this, not invented speculatively here.

No new token gaps: every colour/radius/padding value reused is either an existing token (`surface-raised`, `border-muted`) or an exact literal already established for this component (`rounded-3xl`, the `pr-4` active-padding precedent).

## TICKET #177 (2026-08-08) — keyboard-accessible swipe reveal

The Winkelmand page (#177) is `swipeToDelete`'s first real consumer, so its own ticket text asked for the previously-flagged keyboard gap above to be assessed now rather than deferred again. Fixed, not re-flagged: the Trash `Button` drops its `tabIndex={open ? 0 : -1}`/`aria-hidden={!open}` gating (native `<button>` is tabbable by default) and gains `onFocus={() => setOpen(true)}` / `onBlur={() => setOpen(false)}` — Tab now reveals the row the same way a pointer drag does, through the same `open` state, and Enter/Space activates the now-visible, now-focused button natively. No change to the drag/gesture code path, the DOM structure, or the stacking order the #160 "bleed-through" bug fix depends on — only the two props on the same `Button` element.

**Known, accepted trade-off, not fixed here:** the Trash button's wrapper `div` is the first child of the row (so it stacks correctly beneath/behind the content row at rest, per #160), which means it is also first in DOM/tab order — tabbing into a row lands on its (now newly revealed) Trash button *before* its Checkbox, reversed from the row's left-to-right visual reading. Reordering the DOM to fix this would touch the exact stacking arrangement #160's own bleed-through fix depends on (content painting over the button at rest); given the cost/risk of touching that again for a within-row ordering nicety, this is accepted as a minor, documented deviation rather than restructured. A real fix (e.g. `z-index` on the content row + DOM reorder) is possible but out of scope for this ticket.

No visual baseline change: the fix only touches `tabIndex`/`aria-hidden`/`onFocus`/`onBlur`, none of which affect static (unfocused) pixels — the existing `card-content-ingredient--swipe-to-delete` baseline (closed/rest state, per its own story comment) is unaffected. `pnpm test:visual` not re-run for this alone.

Visual baselines regenerated (`playwright test --update-snapshots`, this component's and every call site's stories that render ingredient rows): `card-content-ingredient--all-variants` (Delete pill removed — no longer a real static state), `card-content-ingredient--delete-label-nl`/`playground` (now require `swipeToDelete`), `card-content-ingredient--no-quantity-with-divider` (no rule below the last row), `card-content-ingredient--swipe-to-delete` (new), `card--all-content-types`, `ingredient-search-panel--filled-results`/`some-rows-checked`, `step-ingredient-panel--empty`/`interactive`/`with-selection`.

## TICKET #166 (2026-08-08) — active animation removed, divider straightened, swipe-to-delete confirmed deferred

Two user-reported bugs, both on the live (non-swipe) row Figma node `4003:5508` pointed at — that exact node id has since been deleted from the file (re-fetched via the REST API this session, both a plain `nodes?ids=` lookup and a page-wide depth-6 traversal of the Development page find nothing under it; `lastModified` on the file is the same day as this ticket, so the designer's own edit removed it). Fixed from the bug reports themselves plus the still-live `3727:4021` component set, not from the deleted node:

1. **"Nog steeds hover/active animaties, mogen eruit."** A second ask after #67 already fixed a *different* active-state bug (Hover wrongly firing on `:hover`) — #67 kept `:active`'s press fill (`bg-surface-raised`, `pr-4`) as intentional, matching the fetched `State=Active` frame. This ticket removes that fill/padding shift entirely; the row no longer changes appearance on press. `swipeToDelete`'s drag-transform mechanism is untouched (a real gesture, not a hover/active CSS animation) — see point 2.

2. **"De border-bottom loopt rond door de radius."** The divider was `border-b border-border-muted` directly on the `rounded-3xl` row. CSS renders a lone `border-bottom` curving into both bottom corners to follow `border-radius` even with no other side present — visible once you look for it, invisible in a quick glance because the curve is subtle at this radius. Fixed by moving the divider to its own `h-px w-full bg-border-muted` sibling **below** the (still `rounded-3xl`, for the swipe branch's clip-corners) row, in both the default and `swipeToDelete` branches — a 0-radius div can't curve regardless of what its rounded neighbour does. `className` moved from the row div to a new outer `flex flex-col` wrapper so it still reaches "the whole component" for any future caller, same contract as before.

3. **Slide-to-delete scope, confirmed not #166's job.** The ticket explicitly named the iOS-style swipe gesture as winkelmand-only, and the winkelmand feature doesn't exist in this codebase yet — verified again this session (no `winkelmand`/`basket`-named route, table, or component beyond the disabled "Voeg toe aan mand" `Button` on `RecipeDetailPage.tsx`). `swipeToDelete` (#160) already models exactly this: an opt-in prop, no live call site, exercised only by the `card-content-ingredient--swipe-to-delete` Ladle story. Left as-is — nothing to build, nothing to remove, just reaffirmed dormant-until-#29 in both places (here and the PR report).

## #179 (2026-08-09) — desktop hover disturbing the swipe, root-caused and fixed

`/winkelmand` now exists (#177) and is `swipeToDelete`'s first live consumer, so #179's own bug report ("op desktop lijkt het ingrediënt component te reageren op hover wat het slide effect verstoord") could finally be checked against real rendered rows, not just the Ladle story. Verified in a real browser (Playwright against `pnpm dev`, `/winkelmand`): confirmed still present, and it is not a CSS hover state at all — #166 already removed every `hover:`/`active:` class from this file, and grepping the current source confirms none remain.

**Root cause: `handlePointerMove` ran unconditionally.** It computed `dragPx = event.clientX - dragStartX.current` on every native `pointermove` the row received, without checking whether a drag was actually in progress. Touch devices only ever fire `pointermove` while a finger is in contact with the screen — so on mobile this was harmless. A desktop mouse fires `pointermove` continuously while merely hovering, with no button pressed at all. Since `dragStartX.current` still held whatever it was last set to (`0` on first render, or a stale value left over from a previous real drag), any mouse movement over the row — pure hovering, no click — computed a large, arbitrary `dragPx` from wherever the cursor happened to be on screen relative to that stale reference point, visibly sliding the row. The ticket's own alternate suspect (`offset < 0 ? "bg-surface-raised pr-4" : "pr-3"`) is a symptom of this, not a second bug: that padding swap only ever fires when `offset < 0`, which only happens once `dragPx` is nonzero.

**Fix**: an explicit `dragging` ref, set `true` in `handlePointerDown` and `false` in `handlePointerEnd`, with `handlePointerMove` returning immediately when it's `false`. `setPointerCapture` (already called on pointerdown) means a real drag's `pointermove`/`pointerup` events are already routed to this element regardless of where the pointer physically is — the new gate only ever suppresses the no-button-down hover case, never a real in-progress drag. A `ref` rather than `useState` for `dragging`: it's read synchronously inside the same event handlers that set it (no render needs to observe it), same reasoning `dragStartX` itself already uses a ref for.

Verified post-fix in the same browser session: hovering back and forth across a row with no click held no longer moves it at all; a real pointer-down drag still opens/closes exactly as before (measured against the `REVEAL_PX`/`OPEN_THRESHOLD_PX` thresholds, unchanged). No visual baseline change — the fix touches only event-handler logic, not markup or classes, so `pnpm test:visual` was not re-run for this alone.

## #179 part 2 (2026-08-09) — `swipeToDelete` generalised to `swipeAction`, `State=Cart` added

Ticket: *"Slide effect toegevoegd voor ReceptDetailPage om ingrediënt individueel toe te voegen aan winkelwagen. Zelfde slide effect als delete op winkelwagen pagina. Enige aanpassing is winkelmand icoon ipv delete icoon."* Re-fetched the whole `Card-content/Ingredient` set (`3727:4021`) — `4050:11613` ("State=Cart, Checkbox=Unchecked") sits alongside `State=Delete` structurally identically: same `Molecule/Ingredient` pill frame, same outer `justify-content: flex-end` row, same `Button/Default` sibling outside the pill. The annotation on `4050:11614` reads "When sliding" — the exact wording `State=Delete` already carries — confirming this is the same gesture, not a new one.

**One real Figma discrepancy caught by fetching rather than assuming**: the revealed Button's `componentId` is `3623:4344` (`Style=Filled, State=Default`), **not** `3693:3386` (`Style=Destructive`, what `State=Delete` uses) — fill `#E7E5E4`/`surface-raised`, icon `Icon/Shopping-basket`, not `Icon/Trash`. The ticket's own text only says "winkelmand icoon ipv delete icoon" (basket icon instead of delete icon); the fetch additionally confirms the *variant* changes too, not just the icon — flagged in the task brief as something to verify, not assume, and the fetch bore it out.

**Generalisation, not duplication.** One gesture (drag state, pointer handlers, open/closed threshold, keyboard focus reveal from #177) now serves two revealed actions, selected by a new required-together prop, same discriminated-union idiom as before: `swipeAction: "delete"` keeps `onDelete`/`deleteLabel` and the destructive Trash `Button`; `swipeAction: "cart"` adds `onAddToCart`/`addToCartLabel` and renders `AnimatedAddToBasketButton` (icon-only mode — see its own note) instead. `swipeToDelete: true` is removed entirely (renamed, not deprecated-and-kept) — every call site updated in the same PR: `WinkelmandList.tsx`, `Card.stories.tsx`, `CardContentIngredient.stories.tsx` (existing stories renamed to `swipeAction="delete"`, new `SwipeToCart` story added). `RecipeDetailPage.tsx`'s ingredient rows are `swipeAction="cart"`'s first live consumer.

**`onFocus`/`onBlur` reveal logic (#177) is now two inline functions (`handleFocus`/`handleBlur`) shared by both branches** rather than duplicated per-action — the keyboard-accessibility fix from #177 needed no re-derivation, just applying to whichever control is rendered.

**Footprint math unchanged.** `REVEAL_PX` (48 = 40px button + 8px gap) still holds: `AnimatedAddToBasketButton`'s icon-only face computes to the same 40×40 as the Trash `Button`, by a different but equally-exact arithmetic path (see `design/notes/AnimatedAddToBasketButton.md`) — no change needed to the swipe distance/threshold constants.

Visual baselines regenerated for stories that changed props/added a new export: `card-content-ingredient--playground`/`delete-label-nl`/`swipe-to-delete` (renamed prop, same rendered pixels — resting/closed state, unaffected by the rename itself) and the new `card-content-ingredient--swipe-to-cart`; `card--all-content-types` (`Card.stories.tsx`'s own swipe row).

## TICKET #205 (2026-08-12): radius/spacing tokens

Measured via `figma_execute`/`boundVariables` across every `State=*`
variant of the component set (3727:4021): `Default,Checkbox=None/Unchecked/
Checked` (3626:4552/3727:4309/3727:4022), `Active,Checkbox=Unchecked`
(3727:4290, chrome lives on its child "Molecule/Ingredient" 3727:4404),
`Cart,Checkbox=Unchecked` (its own "Molecule/Ingredient" 4050:11614). The
row's `gap-5` → `gap-inline-xl` everywhere (`itemSpacing`→
`spacing/inline/gap-xl` on every state, byte-identical). Padding: closed/
default row `pl-3 pr-3 py-3` → `pl-component-md pr-component-md
py-component-md` (Default state's own `padding*`→
`spacing/component/padding-md` on all four sides). Swiped-open row's
asymmetric `pl-3 py-3` / `pr-4` (vs. closed `pr-3`) → `pl-component-md
py-component-md` / `pr-component-lg` (vs. `pr-component-md`) — Active's
`paddingRight` genuinely binds the LARGER `spacing/component/padding-lg`
(16px) while `paddingLeft/Top/Bottom` stay `padding-md` (12px), so the
existing offset-dependent `pr-4`/`pr-3` split already tracked two real,
distinct Figma states (Default's symmetric 12px vs. Active's asymmetric
16px right edge) — not an arbitrary UI flourish, now expressed in tokens
instead of raw steps.

`rounded-3xl` (both the swipe wrapper and the row itself, every branch) →
`rounded-container`. Directly measured on Active/Cart's "Molecule/
Ingredient" frames (`topLeftRadius`→`radius/container`, 24px). The
`Default` state's own sampled node shows NO radius at all (0, no
`boundVariables` entry) — Figma's static Default sample apparently omits
the swipe-reveal chrome. `rounded-3xl` was already applied uniformly across
every state before this ticket (#166's own overflow-hidden/divider
reasoning), a pre-existing, documented decision this ticket doesn't
revisit — only retokenizes, since `radius-container` (24px) and the
previous `rounded-3xl` (24px) compile to byte-identical CSS.

**Left unconverted (no measurable node):** "Ingredient + quantity"'s 80px
itemSpacing is unbound in Figma and isn't rendered via an explicit gap
class in code anyway (`justify-between` handles it). `Tag`'s own
`spacing/mini` gap is Tag.tsx's own flagged gap (see design/notes/Tag.md),
not this component's to fix.

## TICKET #222 part 2 (2026-08-16) — desktop checkbox click swallowed by pointer capture

Measured, not guessed, per the ticket's own instruction: built a standalone
diagnostic (a bare HTML page with a div wrapping a button, run through a
dedicated Playwright script — the shared `figma-console`/Playwright-MCP
browser was locked by another concurrent session, so a fresh
`@playwright/test` `chromium.launch()` instance was used instead) that
confirmed `event.currentTarget.setPointerCapture(pointerId)`, called
unconditionally in `handlePointerDown`, retargets the browser's subsequent
`click` to the *capturing* element (the row div) rather than the actual
element under the cursor — a real, trusted mouse click on a nested `<button>`
never reaches its own `onClick` once its ancestor has taken capture.
Re-confirmed against the real component (not just the toy page), via
`pnpm ladle`: a mouse click on the swipe branch's rendered `Checkbox` fired
on the row div pre-fix and on `BUTTON[role=checkbox]` post-fix.

Two candidate fixes named in the ticket brief, both measured rather than
picked by inspection:

1. **Release capture on `pointerup`, before `click` fires.** Measured NOT to
   work: by the time the release call runs inside the `pointerup` handler,
   Chromium has already retargeted the compatibility `mouseup`/`click` pair
   to the captured element. Rejected.
2. **Take capture lazily — only once real movement crosses `TAP_SLOP_PX`, in
   `pointermove` rather than `pointerdown`.** Measured to work: a plain
   click has zero movement or sub-slop jitter, so no `pointermove` fires (or
   the one that does is gated out) before `pointerup`, capture is never
   taken, and `click` reaches its real target natively. Implemented.

**Why touch already worked, and still does.** Touch pointers get *implicit*
pointer capture from the browser at `pointerdown`, on whatever element is
actually under the finger, independent of any JS call — this component's
explicit call was never what kept a touch drag tracking outside the row's
bounds. Re-verified post-fix with trusted CDP touch injection
(`Input.dispatchTouchEvent`, not a synthetic `new PointerEvent()` +
`dispatchEvent`, which throws `InvalidStateError` from `setPointerCapture` on
untrusted events and is not a valid test for this): a touch tap on the
Checkbox still fires nativntely, and a touch drag still reveals the Trash/
AddToBasket button (the revealed button's wrapper `transform` measured going
from `translateX(48px)` at rest to `translateX(0px)` fully open).

Also re-verified unaffected, since neither depends on pointer capture:
tap-to-close (tapping the open row's content, not the revealed button) and
the #177 keyboard Tab-reveal path (still lands on the Trash button before the
Checkbox — the pre-existing, documented DOM-order trade-off, unchanged).

New `captured` ref (same reasoning as the existing `dragging` ref: read
synchronously inside the handlers that set it, no render needs to observe
it) tracks whether capture has already been taken for the current press, so
it's requested at most once per gesture, not repeatedly on every move past
the threshold.

No visual baseline change: the fix touches only `handlePointerDown`/
`handlePointerMove` logic, not markup, classes, or styles.

## TICKET #222 point 6 (2026-08-16) — Tag no longer wraps under a long name

`content`'s `flex w-full items-center justify-between` row left both the
name `<p>` and the `Tag` at the flex default (`shrink: 1`, no basis
override); with neither protected, a long name's larger content-basis pulled
width away from the Tag until the Tag's own text wrapped inside its fixed
`h-10` — the reported two-line tag.

Fixed in this molecule, not `Atom/Tag`: measured via the atom's other real
consumers before touching anything (see design/notes/Tag.md's mirrored
entry) — `CardContentTicket.tsx` and `CardContentStep.tsx` both stack their
Tag(s) on their own `flex-wrap` row *below* the text (`flex-col` + gap),
never sharing a horizontal flex row with growing text the way this
component's `content` div does. The squeeze is unique to this layout, not a
property of the atom, so `Tag.tsx` stays untouched.

Two additions to the `content` div: `<Tag className="shrink-0">` (never
shrinks below its natural single-line width) and `<p className="min-w-0">`
(explicitly allowed to shrink below its own min-content width so it absorbs
the deficit by wrapping). Standard flex "long text wraps, fixed sibling
holds its width" pairing — no new token, no spacing change.

Verified with a new Ladle story (`LongNameWrap`, an extreme-length Dutch
name) measured via Playwright: the Tag's rendered height stayed 40px
(`h-10`, one line) while the name `<p>` measured 48px (two lines at
`text-base`'s line-height) — screenshotted for a visual check too.

The new story shifts the baseline set on the next full `pnpm test:visual`
run (a new story, not a regenerate of an existing one) — left for the
orchestrator's centralized run per this session's scope change, not
regenerated here.


## "controleren" marker (Claude-designed on request, #318)

Optional `reviewLabel` (+ `onReviewClick` makes it a button): a `Tag variant="highlight"` under the name, for an imported line with `needs_review`. Existing `Tag` only, no new tokens. On the detail page pressing it opens the edit panel. Story `NeedsReview`.

Same marker, label "niet meegeteld", for a line the nutrition totals leave out (2026-10-07, see design/notes/RecipeDetailPage.md). Story `NotCounted`.
