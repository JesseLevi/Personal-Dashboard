# BoardView

- **Code:** `components/organisms/BoardView.tsx`
- **Node IDs (canonical in `figma-map.json`: `3680:1442`):**
  - `3680:1442` "Te doen/Desktop/Filled" — fetched first tool-call, per ticket
  - `3680:1435` "Te doen/Mobile/Filled"
  - `3878:10175` "Te doen/Desktop/EmptyState"
  - Drag Dev Mode annotations (REST API, not in the MCP payload — same gap `docs/guides/ui-components.md` documents): `I3881:13782;…;3624:4421` "Dragging with mouse", `I3881:13252;…` "When moving 40% opacity", `I3882:14853;…` "When close to new place in column show placeholder. Jira/Trello also have this effect", `I3882:14505;…` "On mobile when holding for 2s activate drag-handle". Frames `3881:13243`/`3882:14844`/`3882:14424`/`3882:14855` (DragHandle/DragNewPlace × Desktop/Mobile) all show the same construction: the normal board plus one absolutely-positioned `Card` at a second x/y — no separate handle layer, no placeholder layer drawn; both are behavioural, not geometric.

Built #90. Not a new Figma leaf component — composes three already-built organisms/molecules exactly as the ticket's own tree states: `Carousel` (row) → `CardContainer` (column: icon/name/count/Plus/Pencil, `emptyState` from #87) → `Card` (per-item wrapper) → composer's `renderItem` (a `Card-content/*` molecule). This file owns only the drag mechanics and the generic column/item plumbing; **no Te-Doen or Recipe field lives here** (no `priority`, no `due_at`, no `imageUrl` parsed anywhere in this component) — those stay in each caller's own `renderItem`.

## dnd-kit generation: `@dnd-kit/react` + `@dnd-kit/helpers` (the ticket's preferred pick, not the classic fallback)

Installed via `pnpm add @dnd-kit/react @dnd-kit/helpers` (+ `@dnd-kit/dom` and `@dnd-kit/abstract` as direct dependencies — both are already transitive deps of the two above, but this file imports named exports from them directly — `PointerSensor`/`PointerActivationConstraints` and `CollisionPriority` respectively — so pnpm's strict `node_modules` requires them declared, not just hoisted). All four resolved at `0.5.0` against this repo's pinned `react@^19.1.0`/`react-dom@^19.1.0` with **zero peer-dependency conflicts** (`@dnd-kit/react`'s own `peerDependencies` already state `"react": "^18.0.0 || ^19.0.0"`) — the ticket's flagged fallback risk (pre-1.0 packages not installing cleanly against pinned React 19) did not materialize, so no fallback to `@dnd-kit/core`+`@dnd-kit/sortable` was needed. Confirmed pre-0.5.0 is genuinely pre-1.0 (the ticket's own caveat, repeated here rather than silently dropped).

API confirmed against Context7 (`/clauderic/dnd-kit`) docs before writing any drag code, then cross-checked against the installed package's own `.d.ts` files (both agreed):
- `useSortable({id, index, group, type: "item", accept: "item"})` per card — `group` is the column id, giving multi-column sorting natively (the ticket's own reason for preferring this generation).
- `useDroppable({id, accept: "item", collisionPriority: CollisionPriority.Low})` per column body — makes an emptying/empty column a valid drop target on its own, not just via its cards' own `useSortable`; `CollisionPriority.Low` is dnd-kit's own documented guidance for this exact shape (item collisions should win over the column's own).
- `DragDropProvider` + `@dnd-kit/helpers`'s `move()` on `onDragOver` for live optimistic reordering (the visual "insert placeholder" effect the Jira/Trello annotation asks for — this is dnd-kit's own default `OptimisticSortingPlugin` behaviour, not custom-built), `isSortable(source)` + `source.group`/`source.index` on `onDragEnd` to build the `onMove` payload, a `snapshot` ref to revert on `event.canceled` (Escape).
- Keyboard: dnd-kit's `KeyboardSensor` is in the **default** sensor set — no explicit `sensors` array was needed for keyboard drag to work at all. Only `PointerSensor` is explicitly reconfigured (see long-press below); `KeyboardSensor` is left completely untouched, per the ticket's own instruction to stay on dnd-kit's default keyboard support rather than inventing bindings.
- `ref` is the *only* thing `useSortable`/`useDroppable` need on the element in this generation — no `attributes`/`listeners` spread (that's the legacy `@dnd-kit/core`+`@dnd-kit/sortable` shape); role/tabindex/aria-* are applied automatically by dnd-kit's own Accessibility plugin.

## No drag handle — verified against the annotations, not assumed

Figma draws no handle layer in any of the four drag frames; the "Dragging with mouse" annotation sits on the `Card` instance itself. `SortableCard`'s `ref` is therefore on the same element `Card` wraps — the whole card is the activator, matching the ticket's explicit "don't invent a handle icon."

## Mobile long-press (2s) — #115: fixed a real never-worked-on-device bug, not just a verification gap

The annotation is explicit: "On mobile when holding for 2s activate drag-handle." Still modelled as `PointerActivationConstraints.Delay({value: 2000, tolerance: 5})` on `PointerSensor` for touch — desktop mice keep the #94 fine-pointer delay+distance — but the *branch* that picked between them, and the CSS around the card, were both wrong.

**Diagnosis, with the evidence that established it (not guessed):**
- Read `PointerSensor`'s installed source (`node_modules/@dnd-kit/dom`, not just the `.d.ts`): `handlePointerDown` calls `this.activationConstraints(event, source, options)`, which — when `options.activationConstraints` is a function — calls it with the **real per-interaction `PointerEvent`** on every single pointerdown. The old code instead computed a static array once, from `window.matchMedia("(pointer: coarse)").matches` read at the time the `sensors` callback ran — the wrong shape entirely, not just a timing nitpick: it can't ever pick differently for two different interactions on the same hybrid device (touch laptop, iPad + mouse), and dnd-kit's own default `activationConstraints` (same file) is itself a function of `event.pointerType` — the library's own idiom for exactly this branch.
- Read the same source for what dnd-kit does with `touch-action`: it injects `touch-action: none` only onto the element carrying its own `data-dnd-kit-dragging` attribute, set only once a drag has actually **started** (`Feedback` plugin, post-activation). During the pending/held phase — the entire 2s window this ticket cares about — dnd-kit sets nothing, and `PointerSensor.handlePointerDown` registers only `pointermove`/`pointerup`/`pointercancel`/`dragstart` listeners, no `touchmove`. Nothing in the library prevents the browser's own native pan-gesture recognizer from claiming the touch and firing `pointercancel` (which `PointerSensor` treats as an abort) before the 2000ms elapses — confirming the ticket's own "strongest lead" (no `touch-action` anywhere in `components/`) rather than the library "already managing it."
- Conclusion: two independent bugs, both real. Fixed both.

**Fix 1 — `boardCardActivationConstraints`, exported from `BoardView.tsx`:** a plain function of `event.pointerType` (`"touch"` → 2s delay; anything else, including `"pen"`, → the #94 fine-pointer constraint — matching dnd-kit's own default grouping, which treats `pen` like `mouse`). No `window` access, so no SSR/hydration question either. Unit-tested (`tests/board-view-sensors.test.ts`, 4 cases) since mounting `DragDropProvider` isn't part of this repo's framework-free Vitest setup.

**Fix 2 (as shipped in #115, superseded by #116 below):** `SortableCard`'s wrapper gained `[@media(any-pointer:coarse)]:touch-none [@media(any-pointer:coarse)]:select-none touch-callout-none` (the last a new `app/globals.css` class for `-webkit-touch-callout: none`, which has no Tailwind utility). `any-pointer: coarse` (not `pointer: coarse`) so a hybrid device with touch capability keeps this even while its *primary* pointer is momentarily a mouse.

**#115's stated trade-off — since disproved on a real device, see #116:** the reasoning at the time was that `touch-action: none` blocks *any* native pan starting on a card for that touch's whole duration, matching Trello/Asana, with the Carousel/page still scrollable from everywhere except on top of a card. The user confirmed on a real device that this was worse than "a documented trade-off" — a long column became fully unscrollable by swiping on a card, which is the normal way to scroll a touch UI. `touch-none` is corrected in #116.

**#115 verification gap, now closed by #116's own device-verification note below:** the sensor branch logic was unit-tested; the touch-action/callout CSS and the 2s-hold-then-drag behaviour were not verified against real touch hardware in this environment (no touch-emulation entry point in the Playwright MCP tools available then, no physical device attached to the worktree).

## Issue #116 — `tolerance: 5` made the hold unreachable, and `touch-none` broke scrolling (both user-confirmed on a real device)

#115 shipped believing both the branch fix and the CSS trade-off were sufficient; a real device proved otherwise: **holding a card for 2s did nothing**, while short taps still opened the detail panel (so pointer handling itself was healthy — the bug was purely in the hold), and **swiping on a card no longer scrolled the column**. Two independent bugs, both now fixed:

**Bug 1 — `tolerance: 5` on a 2000ms `Delay` constraint is unreachable in practice.** `DelayConstraint` (`node_modules/@dnd-kit/dom/index.js:1867-1877`) measures Euclidean distance from the pointerdown point on every `pointermove` and calls `abort()` past the tolerance — and `abort()` clears the pending timer permanently; it never re-arms. 5 CSS px on a DPR-3 phone is roughly half a millimeter of real finger movement, well inside what a fingertip's contact patch drifts from pressure changes alone over 2 full seconds, so the timer was reliably killed by ordinary jitter long before 2000ms elapsed. (dnd-kit's own default *does* use tolerance 5, but paired with a 250ms window — #115 stretched the window 8× and left the tolerance untouched, which is what turned a workable default into an unreachable one.)

**Bug 2 — `touch-none` breaks the normal way to scroll a touch UI.** Confirmed above: fixed by dropping it in favor of `touch-manipulation` (see the "SortableCard" comment in the component — full reasoning below).

**The fix, and why the two bugs are coupled:** restoring panning on the card (`touch-manipulation` instead of `touch-none`) hands scroll-vs-hold discrimination back to the browser, which is exactly what makes a *larger* tolerance safe rather than reopening bug 1's failure mode. Browsers apply their own slop — commonly cited in the ~10px range, though the exact figure isn't standardized and varies by engine — before committing a touch sequence to a pan; once committed, the browser fires `pointercancel` on the element, which `PointerSensor`'s existing `handleCancel` already treats as an aborted activation (this is not new code — it is the same cancel path `DragDropProvider`'s `onDragEnd`/`event.canceled` handling already covers). So:

- A **deliberate swipe** moves past the browser's own slop quickly, the browser claims the gesture and fires `pointercancel`, and dnd-kit cleanly aborts — regardless of what `tolerance` is set to, because this path never depends on `exceedsDistance` at all.
- A **still (but human) finger** during a genuine 2s hold moves within that same slop budget and the browser never claims the touch, so no `pointercancel` fires — this is the case `tolerance` now has to cover, and only this case.

**Why 16, not 5 or an arbitrarily large number:** `tolerance` no longer has to *discriminate* scroll from hold (the browser does that); it only has to *absorb* involuntary jitter that stays under the browser's own slop, so it should sit a little above that slop rather than at or below it — otherwise `exceedsDistance` could still abort a still-finger hold on a browser whose slop threshold runs slightly above the commonly-cited ~10px (engines are not required to agree on the exact figure), before the browser itself would have called it a scroll. 16 gives roughly 50% headroom over that ~10px reference point: enough to not re-create bug 1 on a stricter/looser engine, while staying far below the distance any deliberate drag gesture covers, so it still functions as a real (if now secondary) safety net rather than an effectively-disabled one. It is a reasoned choice, not a re-measurement of finger physiology — no device access existed here to tune it empirically; a real-device check that a still 2s hold survives and a deliberate swipe scrolls is the open verification (below).

**Trap avoided:** `tolerance` is never passed as `undefined`. `DelayConstraint.exceedsDistance` (`node_modules/@dnd-kit/dom/index.js:1874`) is called unguarded — unlike `DistanceConstraint` (line 1833), which guards with `tolerance &&` — and internally does `"x" in distance`, which throws a `TypeError` for any non-number on the very first `pointermove`. `tests/board-view-sensors.test.ts` locks this down with an explicit `typeof … === "number"` assertion, not just an equality check against 16, so a future edit that drops the field fails loudly in CI rather than only in a browser.

**Verification at the time of #116:** the sensor branch/tolerance logic is unit-tested (`tests/board-view-sensors.test.ts`). The compiled CSS was read directly out of `.next/static/css/` after a clean `rm -rf .next && pnpm build` to confirm the coarse-pointer rule says `touch-action:manipulation` rather than trusting the source class name. The actual hold-then-drag behaviour, the restored swipe-to-scroll, and the browser's real slop/`pointercancel` timing were **not** verified against real touch hardware in this environment at that time — closed since, see #118 below: #117's on-device diagnostic confirmed all three on real iPhone/iPad Safari.

## Issue #118 — hold shortened to 750ms (confirmed working device, and a real Figma deviation)

#117's diagnostic route closed #116's own open verification gap: the user confirmed on real iPhone *and* iPad Safari that drag, scroll and tap all work as designed. The reported "drag is broken" symptom was never the sensor — it was the 2000ms hold itself, which the user described as feeling broken enough that they let go twice before the timer ever completed. #115/#116 are therefore closed as working, not open.

**What changed:** `boardCardActivationConstraints`'s touch branch drops from `Delay({value: 2000, tolerance: 16})` to `Delay({value: 750, tolerance: 16})`. Reference points for the new number (not a re-derivation of #116's tolerance reasoning, which is untouched): iOS and Android's own native long-press both land near 500ms; dnd-kit's own default `Delay` is 250ms. 750ms sits above both, closer to native feel than the old 2s without matching either platform default exactly.

**Real hardware now confirms #116's design, closing its own open verification gap.** #117's diagnostic route let the user watch pointer/activation events live on iPhone and iPad Safari: drag, scroll and tap all work as designed — the coarse-pointer CSS and the sensor branch were correct all along, only the 2000ms window made the interaction feel broken. One mechanism worth recording so it isn't re-derived: dnd-kit's own docs describe `touch-action: none` as the only reliable way to suppress a browser's native scroll during a pointer-based drag, which reads as if this component's `touch-manipulation` choice (kept for panning, see #116 above) should be unreliable. It is not a contradiction — those docs are about suppressing scroll *during* an active drag, and dnd-kit already owns that itself once a drag activates, independent of the CSS `touch-action` value: `setPointerCapture` on `body` plus a non-passive `touchmove` listener calling `preventDefault` (with `patchWindow()` pre-registering a non-passive window `touchmove` so the event stays cancelable at all). So the *pending*-phase `touch-manipulation` and the *active*-phase scroll-lock are two different mechanisms solving two different problems, and confirmed compatible on real iOS Safari, not just reasoned about.

**`tolerance: 16` deliberately kept, not re-tightened.** #116's reasoning for 16 (absorbing hold jitter under the browser's own pan-commit slop, now that the browser owns scroll-vs-hold discrimination — see above) doesn't depend on the delay window's length, so it carries over unchanged. Over 750ms instead of 2000ms, 16 is more headroom than the jitter budget strictly needs, but a too-tight tolerance was the *original* failure mode (#116's bug 1) — erring generous here is intentional, not an oversight to fix later.

**This is a Figma deviation, not an implementation detail — flagged, not silently resolved.** The Dev Mode annotation on node `3680:1442` still reads "On mobile when holding for 2s activate drag-handle." Shipping 750ms is the user's own product call, made after the real-device test #117 enabled, but it means Figma is no longer the source of truth for this one value until design either updates the annotation or ratifies the code. Tracked at `docs/open-questions.md#touch-hold-duration-deviates-from-figma`.

**#117's diagnostic route (`app/debug/drag/`) is deleted with this ticket** — it had exactly one job, letting the user watch pointer/activation events on real hardware, and that job is done. Confirmed no other file references the deleted path.

## `onMove` — reporting only, confirmed by testing that nothing else writes state

`BoardView` keeps a local `itemsByColumn` (`Record<columnId, TItem[]>`) purely so `@dnd-kit/helpers`'s `move()` can give live drag-over feedback — this is **not** persistence, it is re-derived from the `columns` prop on every prop change (except mid-drag, so a prop update can't yank a card from under the pointer) and thrown away on unmount. `onDragEnd` calls `onMove({itemId, toColumnId, toIndex})` once per real (non-canceled) drop and does nothing else — no fetch, no Supabase, no mutation of the `columns` prop itself. The `Default` story's own `onMove` handler is the one place that turns this into a visible change, exactly the way a real page's server-backed handler would, and that mechanism was what got exercised end-to-end in the browser checks below.

## Column widths — re-measured for this ticket, `Carousel.tsx` changed

Ticket-stated numbers (320 desktop / 296 mobile / 312×160 empty) reconfirmed directly against the three fetched nodes:
- `3680:1442` (desktop filled): every `Card-container` instance (`layout.dimensions.width`) = **320**.
- `3680:1435` (mobile filled): three of four columns = **296**; the fourth ("Afgerond") measures 320 — a Figma authoring anomaly, not a fourth intentional width (see `design/notes/Carousel.md` for the full note; not corrected here).
- `3878:10175` (desktop empty): `layout_b7437a7a` = **312×160** on every `Card-container` instance.

320/296/312 are three different numbers for what is visually "the same column," none of them `Carousel.tsx`'s existing 280px (`w-70`, sourced from the *Recipe* screens' own instance override, #24). `Carousel.tsx` gained a `columnWidthClassName` prop (default `"w-70"`, so Recipe's own call sites are unchanged) — `BoardView` passes `"w-74 md:w-80"` (296px mobile-first → 320px at `md:`, Tailwind v4's `w-<n> = n × 0.25rem` dynamic form this codebase already uses for `w-70`). The 312px empty-state width is **not** separately modelled: `CardContainer.md`'s own #87 note already flagged 312 vs. 296/320 as a real discrepancy "for a future ticket that wires the empty state into Carousel" — this is that ticket, and the empty-state `Card-container` still renders inside the same `columnWidthClassName`-controlled wrapper as a filled one (no separate width for the empty case), so the gap stays open rather than being silently resolved one way or the other.

## Scroll affordance — still open, not decided here

`design/notes/Carousel.md`'s open question (no arrows/dots/scrollbar/fade in the fetched node, despite the user's claim that the design accounts for it) was re-checked against all three of this ticket's own nodes and found the same: nothing. Per the ticket's explicit instruction this is **not resolved here** — `Carousel.tsx`'s existing `overflow-x-auto` stand-in is inherited unchanged.

## Verification — mouse and keyboard, both in a real browser against `pnpm ladle`

Playwright driven against a live `pnpm ladle` dev server (not `ladle:build`), `board-view--default` story:
- **Mouse**: `page.mouse.move/down/move×N/up` (not `locator.dragTo()` — that emits native HTML5 drag events, which dnd-kit's `PointerSensor` does not listen for; confirmed by first trying `dragTo()` and observing the drag silently "dropped onto itself" with no reorder). A slow multi-step pointer path from one card to a card in a different column moved it across columns at the exact drop index, updating both columns' counts and the visible order.
- **Keyboard**: focus a card (click, or real `Tab` order), `Space` to pick up (dnd-kit announces "Picked up draggable item …"), `ArrowRight`/`ArrowDown` to move — live cross-column preview confirmed via the accessibility-tree snapshot between keydowns — `Space` again to commit. Verified both a same-column reorder and a cross-column move this way.
- **Empty column as a drop target**: dragging the sole card out of a column empties it (its `CardContainer` swaps to `emptyState`) and dropping onto the now-empty "Afgerond" column's add button area places the card there — this only worked after moving the droppable ref off a `display:contents` wrapper (see below); confirmed broken, then confirmed fixed, in the same browser session.

## Bug caught by testing, not just typechecking: `display:contents` droppable has no hit-box

First implementation wrapped each column's card list / empty-state button in `<div ref={dropRef} className="contents">` to keep `useDroppable`'s ref off `CardContainer`'s own layout (`display: contents` removes the wrapper from layout entirely, which was the point — CardContainer's own `flex`/`gap-2`/`items-center` classes would then apply directly to what look like its immediate children). This type-checked and rendered pixel-identically, but **dragging into an empty column silently failed** (drop landed back on the source) — a `display:contents` element has no box for `getBoundingClientRect`-based collision detection to hit-test against. Fixed by giving the droppable ref a real box instead: the non-empty wrapper now carries its own `flex flex-col gap-2` (the `gap-2` that used to come for free from `CardContainer`'s own flex container now has to be re-declared one level down, since that container now has only one child — this wrapper — instead of N cards), and the empty-state wrapper carries `flex w-full flex-1 items-center justify-center` (deliberately larger than the visible button's own footprint, so the *whole* near-empty column body is a drop target, not just the button — matches the ticket's own Jira/Trello callout without changing what's visually drawn). Re-verified both branches end-to-end after the fix (see above).

## TICKET #95 — `dragDisabled` prop

New optional `dragDisabled?: boolean`, threaded into every `useSortable`'s
and `useDroppable`'s own `disabled` option (both confirmed via Context7 to
accept it directly) plus a `cursor-default` swap on the card wrapper.
Defaults to `undefined`/falsy, so every existing caller (the `Default`
Ladle story, `TeDoenBoard.tsx` when no sort is active) is unaffected. Set by
`TeDoenPageBody.tsx` whenever a `?sort=` view is active — full reasoning
(why disable instead of resetting sort on drag, or writing against the
sorted view) lives in `design/notes/TeDoenBoard.md`, not duplicated here.

## Not built here

- Persistence of any move (separate ticket, per the issue text).
- A drop-animation/placeholder skin beyond dnd-kit's own defaults — the "insert placeholder" effect the Jira/Trello annotation describes is dnd-kit's built-in optimistic-reorder behaviour (cards physically move as you drag over them), not a separate highlighted-slot graphic; Figma draws no such graphic either.

## TICKET #94 — `onItemClick` + a real mouse activation constraint

Added `onItemClick?: (item: TItem) => void`, threaded straight through to `SortableCard`'s own wrapping `<div>` as a plain `onClick`. No manual "was this a drag" bookkeeping was needed: `@dnd-kit/dom`'s `PointerSensor`, once an activation constraint is actually met and a drag starts, binds its own `click` listener with `preventDefault()` on the source element (confirmed in the installed package, not assumed) — so a real drag's trailing click is already suppressed by the library itself, and a plain click (no drag activated) reaches `onClick` untouched.

That only works, though, if a plain click doesn't *itself* satisfy some activation constraint first. It turns out the library's own default for a **mouse** pointer whose event target is the drag handle/element itself — which, per this file's own "no drag handle" section above, is unconditionally true here (the whole card is the handle) — is `void 0`, i.e. **no constraint at all**: any pointer movement, however small, activates a drag immediately. The line 29 comment this replaced ("desktop mice are left on the library default (instant/small-distance)") was wrong about what that default actually is for this exact case — re-read directly from `@dnd-kit/dom`'s `PointerSensor` source (`defaults2.activationConstraints`) while implementing #94, not from the docs, since the docs don't spell out the mouse+handle special case. Fixed by applying the library's own *non-handle* default explicitly instead of relying on the special case: `[Delay({value:200, tolerance:10}), Distance({value:5})]`, for fine pointers only (the existing 2s coarse-pointer long-press is unchanged). A plain click (mouse down/up with negligible movement, well under both the 200ms/10px delay-tolerance and the 5px distance) now never activates a drag at all, so its `click` event fires normally; real dragging (movement past 5px, or held past 200ms with more than 10px of jitter) still activates immediately, same as before.

Verified in a real browser against `pnpm ladle` (`board-view--default`, `onItemClick` wired to a visible counter in the story): repeated plain clicks on a card each fire exactly once, no drag visuals appear and no card reorders; a real mouse drag (down, move well past 5px, up over another column) still reorders/cross-column-moves correctly and does **not** also fire a click. Keyboard drag (`Space`/arrows/`Space`) is untouched by this change (`KeyboardSensor` isn't part of this constraint) and re-verified working.

## Issue #110 — scroll chain fix lives entirely in `Carousel.tsx`, not here

The hidden scrollbar, the clip-at-sidebar (not padding-edge) fix, and the
new right margin — all three review-feedback points on the
`AppShellNav → PageHeader/Carousel` scroll/padding chain this file composes
into — landed entirely in `Carousel.tsx`'s own root `div` (the actual
`overflow-x-auto` element `BoardView` renders via `<Carousel
columnWidthClassName={BOARD_COLUMN_WIDTH} className={className}>`). No
change was needed in this file: `BOARD_COLUMN_WIDTH`, the drag mechanics,
and the column/droppable plumbing above are all unaffected. Full mechanism,
Figma margin numbers, and the browser verification (both sidebar states,
mobile, the collapse animation, all four scroll-input methods, and — the
one check specific to this file's own concern, drag-and-drop hit-testing
after a horizontal scroll on the now differently-sized/margined row) live in
`design/notes/Carousel.md`, not duplicated here.

## Issue #114 — desktop drop hover: reproduced in Ladle first, ruled out this file

The ticket gave two mutually exclusive candidate causes and an explicit order: reproduce in `pnpm ladle` (no server action there) before touching anything. Measured with Playwright driven against a live `pnpm ladle` server (`board-view--default`): real `page.mouse.down/move×15/up` across columns, timestamping via a `pointerup` listener plus a `requestAnimationFrame` loop polling the (re-queried, not cached — the card's DOM node is a different instance post cross-column move, a fresh React mount under the new column's list) dragged element's `getBoundingClientRect()` until 8 consecutive stable frames. **Result: the card's position stopped changing ~246ms after mouseup** — matching dnd-kit's own documented 250ms default drop-animation duration (Context7 `/clauderic/dnd-kit`, `feedback.mdx`) almost exactly. This file's own drag mechanics/sensor config are not the cause — cause 1 ruled out by measurement, not assumption.

By the ticket's own elimination (fast in Ladle → the hang is specific to `/te-doen`), the cause is the `moveCard()`/`router.refresh()` round trip in `app/(app)/te-doen/TeDoenBoard.tsx`, not this component — the fix lives entirely there. Full reasoning: `design/notes/TeDoenBoard.md`'s own `TICKET #114` section. Nothing in `BoardView.tsx` changed for #114.

**Not verified against the real `/te-doen` route** — this worktree has no `.env` (Supabase credentials are git-ignored per `CLAUDE.md`, and this dev machine has no local Supabase/Docker), so the actual authenticated board couldn't be exercised end-to-end. The fix (removing `router.refresh()` from a successful drag-move, since `applyCardMove`'s optimistic result already is the correct end state and `moveCard` re-queries live sibling positions server-side on every call rather than trusting client-cached ones) is reasoned from reading `TeDoenBoard.tsx`/`actions.ts` directly, not from reproducing the 3s hang live.

## TICKET #205 (2026-08-12): spacing token

The sortable-cards wrapper's own `gap-2`→`gap-stack-sm`. Not independently
re-measured (this wrapper exists only for `useDroppable`'s hit-test, per
this file's own comment) — bound to the same token as `CardContainer`'s
"Content" slot (`spacing/stack/stack-sm`, see design/notes/CardContainer.md's
#205 entry), which this wrapper stands in for pixel-for-pixel.

## Muted items (`isItemMuted`)

Optional `isItemMuted(item, columnId)`: the item's `SortableCard` wrapper gets `opacity-30 line-through` (whole card, not just content). Evaluated against the column the item currently sits in (live drag state), so a card dragged into/out of the muted column updates on hover. `isDragging`'s `opacity-40` comes later in `cn()` and wins while dragging. Used by `/te-doen` for the last column; Ladle story `LastColumnMuted`.
