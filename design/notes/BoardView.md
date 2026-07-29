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

## Mobile long-press (2s) — implemented, verification gap flagged

The annotation is explicit: "On mobile when holding for 2s activate drag-handle." Modelled as a `PointerActivationConstraints.Delay({value: 2000, tolerance: 5})` applied to `PointerSensor`, but **only when `window.matchMedia("(pointer: coarse)").matches`** — desktop mice keep the library's own default (small-distance) activation, matching "direct slepen met de muis, geen apart handvat" in the same annotation set. `(pointer: coarse)` is a genuine exception to this codebase's usual "`md:`-only, never JS breakpoint detection" rule (`design/notes/SidePanel.md`): that rule is about *visual shape*, which has a CSS answer; this is about *input mechanism* (touch vs. mouse), which has no CSS/Tailwind equivalent and can only be read in JS, so it isn't the same category of shortcut that rule was written to forbid.

**Gap, flagged not silently claimed:** verified by reading dnd-kit's own `PointerActivationConstraints`/`PointerSensor.configure` API (Context7 + the installed `.d.ts`), not by exercising an actual 2-second touch-emulated hold in Playwright — the ticket's own acceptance criteria only require mouse + keyboard drag verified in a real browser, and that is what was actually run (see below). A future ticket that touches mobile board fidelity should add a `page.touchscreen`-driven Playwright check for this specific constraint.

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
