# /te-doen page (`page.tsx` + `TeDoenBoard.tsx`)

- **Code:** `app/(app)/te-doen/page.tsx` + `[boardId]/page.tsx` (both thin,
  Server Component), `TeDoenPageBody.tsx` (Server Component, shared body),
  `board-data.ts` (server-only board/sort resolution), `TeDoenHeader.tsx`
  (client — dropdowns/favourite/panel state), `TeDoenBoard.tsx` (client
  board wrapper), `BoardPanel.tsx` (client — add/rename board panel).
- **Node IDs:** `3680:1442` (desktop filled), `3680:1435` (mobile filled), `3670:1696` (Card-content/Ticket), `3877:6693` (Sort dropdown open), `3878:12036` (Switch-board dropdown open), `3878:9060` (AddBoard panel) — same nodes `BoardView.md`/`CardContentTicket.md` already document; this file only records the page-level wiring decisions, not component structure already recorded there.

Built #93. Not a new Figma leaf component — the page composes `PageHeader` +
`BoardView` (#90) + `CardContentTicket` (#21) + `Tag` (#14/#97) exactly as
Figma nests them; nothing here is a fresh atomic-design component, so
neither file is added to `design/figma-map.json` (same precedent as
`AppShellNav.tsx`, also page-level composition, also unmapped).

## Server/client split

`BoardView`'s `renderItem` is a function prop, which can't cross the
Server->Client boundary (not serialisable). `page.tsx` therefore stays a
Server Component that does the Supabase fetch and passes only plain,
serialisable data (`BoardWithColumns`) to `TeDoenBoard.tsx`
(`"use client"`), which owns `renderItem` and everything that needs
`useTranslations`/`useFormatter`. This is the same shape `AppShellNav.tsx`
already established for `Sidebar`.

## "Active board" = explicit `[boardId]`, falling back to favorite (#95)

Superseded by #95's real `[boardId]` route — see that section below for the
current shape (`board-data.ts`'s `loadTeDoenPageData`). Kept here as
history: pre-#95, `page.tsx` took `getBoardsForUser()`'s first row (already
favorite-first, then `position`) with no switcher UI at all; that "favorite
= default" reading is exactly what #95's fallback-when-no-id path still
does, just reachable from two routes now.

**Empty-board fallback:** the seed trigger (`seed_default_board()`,
`supabase/migrations/20260723000001_kanban_schema.sql`) guarantees every
user gets a default board, so `boards.length === 0` shouldn't happen — but
it's a reachable state (a user could delete their last board once that
ships), so `page.tsx` renders a translated empty state
(`components.pageHeader.todo.emptyBoard{Title,Body}`) instead of crashing
on `boards[0].id`.

## Ticket-card composition (`TeDoenBoard`'s `renderItem`)

`CardContentTicket`'s `children` slot takes composer-supplied `Tag`
instances (see `CardContentTicket.md` — no typed `priority`/`labels` prop
exists on that node). Order matches every sampled card in `3680:1442`:
priority, then size, then due date.

- **Priority -> `Tag` variant**: `cards.priority` (`low|medium|urgent`) maps
  1:1 onto `Tag`'s existing variant names (`Tag.tsx`/`Tag.md`, #97) — no new
  variant added. The DB `Row` type is codegen'd as plain `string` (the CHECK
  constraint isn't reflected in TS), so `TeDoenBoard.tsx` validates against
  the three known values before it reaches `Tag`'s `variant` prop or the
  `boards.priority.*` catalog, falling back to `medium` (the column's own
  DB default) for anything unexpected rather than crashing.
- **Priority label text — deliberately NOT the fetched Figma string.**
  `Tag.md`'s #97 entry already flags the sampled per-instance text ("Medium"
  on the Yellow tag, "Mid" on Blue, "300 gr" on Grey) as stale placeholder
  content left over from whatever card each instance was last dragged onto
  in the Figma canvas, explicitly "not used as a naming signal." New keys
  `boards.priority.{low,medium,urgent}` were added instead (nl: Laag/
  Gemiddeld/Urgent, en: Low/Medium/Urgent) — same treatment as
  `components.buttonToggle.categories.*` for a closed enum needing a
  translated display label.
- **Size -> `Tag variant="neutral"`, `card.size.toUpperCase()`.** Treated as
  data (like a column name), not a translated label — the ticket's own
  table shows the raw value ("S") as the display text, no separate word per
  size exists in the fetched node. Omitted entirely when `size` is `null`
  (nullable column).
- **Due date -> `Tag variant="neutral"`, `useFormatter().dateTime`.**
  Formatted via next-intl's client `useFormatter` (`day/month/year:
  "2-digit"/"2-digit"/"numeric"`) against the active locale, not a manual
  string-concat and no new date dependency, per the ticket. Renders
  `dd-mm-jjjj` under the current hardcoded `nl` locale
  (`i18n/request.ts`), matching the Figma literal "01-04-2026" by
  coincidence of locale, not by copying the string. Omitted when `due_at`
  is `null`.

## Column icon — same free-text-vs-union gap as `CardContainer.md` already flagged

`board_columns.icon` is DB `text`, validated only for non-emptiness at the
schema layer (`lib/boards/schemas.ts`'s own comment already says
"validated against the IconName union at render time"). Added
`isIconName` (`components/atoms/Icon.tsx`) — a small runtime guard reusing
the atom's own `ICONS` map — so a column with a DB icon string outside the
`IconName` union falls back to `CardContainer`'s existing `"Croissant"`
default instead of crashing the page. The seed columns
(`Lightbulb`/`AlarmClockCheck`/`Loader`/`CircleCheck`) are all valid
`IconName` members today (confirmed against `Icon.tsx`); this guard is for
columns created later through UI not yet built.

## Not built here

- Board switcher, favourite toggle, sort — built in #95, below.
- `onMove`/`onEditColumn` are still left unset on `BoardView` — drag
  persistence is #96, column rename has no UI yet either.

## TICKET #95 — header interactions: board switcher, favourite, add/rename board, sort

Node IDs used: `3877:6693` (Sort dropdown open), `3878:12036` (Switch-board
dropdown open), `3878:9060` (AddBoard panel). New files: `board-data.ts`
(server-only board/sort resolution, shared by both routes below),
`TeDoenPageBody.tsx` (Server Component body shared by both routes),
`TeDoenHeader.tsx` ("use client" — owns both floating dropdowns, the
favourite toggle, and the add/rename panel's open state), `BoardPanel.tsx`
(the AddBoard SidePanel content). None of these are added to
`design/figma-map.json` — same page-level-composition precedent as
`TeDoenBoard.tsx`/`CardDetailPanel.tsx` above.

### Board is in the URL: `/te-doen/[boardId]`, `/te-doen` falls back to favourite

New route `app/(app)/te-doen/[boardId]/page.tsx` alongside the existing
`app/(app)/te-doen/page.tsx`; both are thin wrappers that just parse
`params`/`searchParams` and render the shared `TeDoenPageBody`. An id that
doesn't resolve (deleted board, foreign id, malformed uuid) falls back to
the favourite rather than a hard 404 — `board-data.ts`'s own comment covers
why. This replaces the "#95 will replace this" note from #93 above.

### Sort is a searchparam, not a mutation — `lib/boards/sort.ts`

`?sort=createdAt|priority|size|alphabetical` is read server-side
(`board-data.ts`) and reorders each column's already-fetched `cards` array
in memory; `position` is never written. No `sort` param = manual/position
order, unchanged from pre-#95 behaviour — **not** "Aanmaakdatum by default"
even though the fetched `SortOnClick` node happens to show that option in
the Selected/filled slot; nothing in the ticket text or the annotations
ties a specific default to that screenshot, and defaulting to the existing
unsorted order is the lowest-risk reading (no board's card order silently
changes on this deploy). Priority order is `urgent > medium > low` — the
ticket's own `mid` slot doesn't exist in this schema's `priority` enum (see
`lib/boards/sort.ts`'s own comment, which points back at the kanban
migration's already-recorded deviation). Tests: `tests/boards-sort.test.ts`.

### Sort vs. drag & drop — dragging disabled while a sort is active (read by #96)

**Decision:** `TeDoenPageBody.tsx` passes `dragDisabled={sort !== null}` to
`TeDoenBoard`, which forwards it to `BoardView`'s new `dragDisabled` prop
(`components/organisms/BoardView.tsx`) — flows into both `useSortable`'s and
`useDroppable`'s own `disabled` option (confirmed via Context7
`/clauderic/dnd-kit`: `useSortable({disabled})` disables both dragging and
being a drop target for that item; `useDroppable` takes the same shape). The
cards stay visible and clickable, just not draggable, and the cursor
switches from `cursor-grab` to `cursor-default`.

**Why disable instead of the alternatives considered:**
- *Reset sort on drag start* — would need `onDragStart` to trigger a
  navigation (clearing `?sort=`) mid-gesture, which either races the drag
  (URL changes, board re-fetches, re-renders with different order, out from
  under the pointer) or requires re-deriving drag state after a route change
  neither dnd-kit nor this app's SSR-per-request model supports cleanly.
- *Let it drag and write against the sorted view* — would let a user drop a
  card between two neighbours in an *alphabetical* view and have that
  computed as a `position` between two *unrelated* manual-order neighbours,
  producing a manual-order result nobody chose or can predict from what they
  saw on screen. This is exactly the "meaningless/misleading" outcome the
  ticket names.

Disabling is the only option that keeps sort a pure, reversible view concern
with zero write-side ambiguity — clearing the sort (navigating back to
`/te-doen/[boardId]` with no `sort` param) immediately restores full drag.

**For #96:** wire `onMove`/persistence exactly as planned, but do not remove
or bypass `dragDisabled` — the prop and its plumbing already exist
end-to-end (`TeDoenPageBody` → `TeDoenBoard` → `BoardView`), so #96 only
needs to attach `onMove` to the real server action; it inherits "disabled
while sorted" for free and should not re-litigate this decision.

### Board switcher, favourite star

- Switcher lists every board from `getBoardsForUser()` (all of the user's
  boards — "Te doen"/"Knutselen"/"Werk" are different `boards` rows sharing
  this one route, not a filtered subset) as plain `Button` rows (`variant`
  filled for the active board, white otherwise) inside a labelless
  `Dropdown` (`children`-only mode — Dropdown's atom doc already calls this
  branch "a static always-open `role="group"`"; TeDoenHeader supplies the
  open/close and positioning itself, conditionally mounting the panel).
  "Toevoegen" is a `Button variant="outline" icon="Plus"` row, matching the
  fetched node's own `Style=Outline` instance for that row, opening
  `BoardPanel` in create mode.
- Favourite: `board.is_favorite` → `Icon/Star`, **disabled** (no UI path to
  unfavorite — the ticket's "the UI must not be able to go around" the
  exactly-one-favorite constraint reads as "never expose an unfavorite
  affordance", not just "don't crash if you try"). Otherwise `Icon/StarPlus`,
  enabled, calling the already-existing `toggleBoardFavorite` action (built
  pre-#95, unchanged) then `router.refresh()`.

### Add/rename board panel — Verwijderen (delete) NOT built, on purpose

The fetched `3878:9060` node's footer shows both a "Verwijderen"/Distructive
button and "Opslaan"/Filled — `BoardPanel.tsx` only renders Save. The kanban
migration's own comment on `boards.is_favorite`
(`supabase/migrations/20260723000001_kanban_schema.sql`) already says
reassigning a favourite after a board is deleted "is for the board-delete
ticket to handle" — a forward reference to a ticket that is not #95. Building
delete here would mean inventing that reassignment behaviour un-briefed, so
it's deliberately left off; a future ticket implements `deleteBoard` and
wires this same footer's delete button. **Rename has no reachable UI
trigger in #95** either: `BoardPanel`/`renameBoard` fully support
`{mode: "edit"}`, but neither fetched header frame draws an edit/pencil
affordance next to the title or in the switcher's per-board rows, so none
was invented (per "never build UI that doesn't exist in Figma yet") — a
future ticket needs to add that trigger once Figma draws one.

### New boards get the same four default columns as the seed trigger

`createBoard` (existing action, unchanged signature) now also inserts
`lib/boards/defaults.ts`'s `DEFAULT_BOARD_COLUMNS` (Ideeën/Klaar/Bezig/
Afgerond, same icons) after the board row — the schema's own
`seed_default_board()` trigger only fires on `auth.users` insert (a new
account's first board), so every *board* created afterwards needs its own
copy of the same four rows. Best-effort or the board itself would still be
unusable if the second insert failed alone: the board row already succeeded
by the time columns are inserted, so a columns-insert failure is logged, not
rolled back — matches "Create new board and open that board in empty state"
(annotation `3878:9059`) either way (empty state === zero cards, columns
still present).

### Dropdown positioning — static, not dynamic collision avoidance

The ticket's "align right to the button; only align left if the screen
can't fit right" describes runtime viewport-collision detection. Descoped to
a static default per dropdown instead (`right-0` for the sort dropdown,
matching the fetched node's own position at the header's far-right edge;
`left-0` for the board switcher, matching its fetched position near the
title/chevron cluster) — building real collision avoidance would mean
introducing new positioning logic beyond "reuse `Dropdown`/`Button`, no new
atoms." Flagged, not silently resolved: a very long board name pushing the
chevron near a narrow viewport's right edge could still clip the switcher
dropdown; nothing currently guards against that case.

## TICKET #94 — `onAddItem`/`onItemClick` wired, card-detail panel added

`onAddItem` and `onItemClick` are now real: both open the same
`CardDetailPanel` (`app/(app)/te-doen/CardDetailPanel.tsx`), owned by a
single `{open, target}` state here. This file is also the only one that
imports `./actions` ("use server") and calls `useRouter()` — both are
passed into `CardDetailPanel` as props (`onCreateCard`/`onUpdateCard`/
`onMoveCard`/`onDeleteCard`/`onMutated`), which stays framework-decoupled on
purpose. `PRIORITIES`/`isPriority` moved out to `lib/boards/enums.ts`
(shared with `CardDetailPanel.tsx`) instead of staying a local copy here.
Full panel wiring, field mapping, and every flagged deviation:
`design/notes/CardDetailPanel.md`.

## TICKET #96 — drag persistence: `onMove` wired to `moveCard`, optimistic update + rollback

`BoardView`'s `onMove` is now real (`TeDoenBoard.tsx`'s `handleMove`), wired
to the existing `moveCard` action (`actions.ts`, unchanged — built pre-#95).
Inherits #95's `dragDisabled={sort !== null}` unchanged (see that section
above); when a sort is active `BoardView` never calls `onMove` at all
(`useSortable`/`useDroppable`'s own `disabled`), so there's nothing for this
ticket to gate a second time.

### Two layers of optimistic state, not one

`BoardView` already keeps its own internal `itemsByColumn`, live-updated via
`@dnd-kit/helpers`'s `move()` on every `onDragOver` and reverted to a
`structuredClone`-style snapshot on `event.canceled` — that's the *visual*
optimism during the gesture itself (`design/notes/BoardView.md`, unchanged
by this ticket). What was missing is a second layer *above* it: `TeDoenBoard`
used to render `columns` straight from the server `board` prop, so once
`onDragEnd` fired (drag no longer "in progress"), any unrelated re-render
would make `BoardView`'s own `useEffect([columns])` re-sync from that
unchanged prop and silently cancel the just-dropped move before the
`moveCard()` request had even returned.

Fix: `TeDoenBoard` now holds `localBoard` (`useState(board)`), the same
"render from local state, re-sync from fetched data only when nothing is
pending" pattern Context7's `/clauderic/dnd-kit`
`sortable-state-management.mdx` documents for exactly this shape (verified
against current docs before writing, per the ticket's own instruction, not
from memory) — `BoardView.tsx` already uses the one-column-of-state version
of this same pattern internally. `columns` (the prop handed to `BoardView`)
is derived from `localBoard`, not `board`, from here on.

- **Apply:** `handleMove` calls the new pure `applyCardMove(board, move)`
  (`lib/boards/optimistic.ts`, tests in `tests/boards-optimistic.test.ts`) —
  removes the card from wherever it currently sits and re-inserts it into
  the target column at the clamped index, the same "remove, then insert
  among the remaining siblings" semantics `moveCard` itself uses server-side
  (`actions.ts`'s `clampedIndex`/`siblings` logic), so the optimistic order
  matches what the server will actually persist. Framework-free and unit
  tested standalone, same shape as `lib/boards/positioning.ts`/`sort.ts`.
- **Snapshot + revert:** `handleMove` captures `localBoard` *before* applying
  the move as `preMoveSnapshot`, then calls `moveCard()`. On
  `{success:false}` (any `BoardsErrorCode`) or a thrown/rejected call,
  `localBoard` reverts to `preMoveSnapshot` and a translated message renders
  (`boards.errors.*` — no new i18n keys: `moveCard`'s closed error-code union
  was already fully covered in both catalogs, same keys `CardDetailPanel.tsx`
  already reuses for the same errors). On success, `router.refresh()` — same
  call every other mutation in this file already makes on success — pulls
  real DB state back down through `board`, which the sync effect then adopts.
- **No toast component exists in this design system yet** (checked before
  building one — none of `components/`, no fetched Figma node for one
  either), so the failure message reuses the exact inline convention
  `CardDetailPanel.tsx`/`BoardPanel.tsx` already established:
  `<p className="text-base font-semibold text-priority-urgent">`. A new toast
  primitive is out of scope for a drag-persistence ticket; flagged here for
  whoever eventually adds one.

### Within-column reorder and cross-column move

Both go through the same `handleMove`/`applyCardMove`/`moveCard` path — the
ticket draws no functional line between them, and neither does `moveCard`
(same `{cardId, columnId, targetIndex}` shape either way, `columnId` just
happens to equal the card's current column for a reorder).

### Edge cases

- **Empty column as a drop target:** unaffected by this ticket —
  `BoardView`'s own `useDroppable` on the empty-state wrapper (#90) already
  makes it a valid target; `applyCardMove` handles inserting into a
  previously-empty column's now-empty `cards` array the same as any other
  (covered in `tests/boards-optimistic.test.ts`).
- **Drop at the end of a column:** `toIndex` arrives as `source.index` from
  dnd-kit already clamped to a real position by its own sortable manager;
  `applyCardMove` additionally clamps defensively
  (`Math.min(Math.max(toIndex, 0), cards.length)`), covered by a dedicated
  test ("moves a card to the end... via a large index").
- **Two quick successive drags:** the *visual* optimistic apply happens
  synchronously for every drop (so the UI never feels laggy), but the actual
  `moveCard()` network calls are serialized through a `moveQueue` ref
  (`moveQueue.current = moveQueue.current.then(() => moveCard(...))...`) — a
  second drop's request only fires once the first has fully settled, so it
  always computes its sibling positions (`moveCard`'s own live DB query)
  against state the first call already persisted, never stale. `pendingMoves`
  is a *count*, not a boolean, specifically so the first move settling
  doesn't flip "nothing pending" back on while a second is still queued
  behind it (a boolean has a real, if narrow, race window here — caught while
  writing this, not assumed away).
  - **Known residual gap, stated plainly:** if the *first* of two queued
    moves fails, its rollback reverts to that move's own pre-drop snapshot,
    which can transiently discard the second move's already-shown optimistic
    result until the second move's own `moveCard()` call (next in the queue)
    resolves and either re-confirms it (success -> `router.refresh()`) or
    reverts it too. The board always converges on server truth either way —
    this is a possible brief visual flicker in a genuinely rare
    double-failure-adjacent scenario, not a data-correctness bug, and wasn't
    worth a full operational-transform-style merge for this ticket.
- **Fractional precision exhaustion:** not touched by this ticket —
  `nextPosition` (`lib/boards/positioning.ts`, unchanged) is still the only
  thing that computes a real `position`, and it already bisects indefinitely
  between two floats without ever reaching either bound (see that file's own
  "keeps bisecting" test). `applyCardMove` never computes or stores a
  `position` at all — it only reorders an in-memory list for display; the
  server, via `nextPosition`, remains the sole source of the real value.
  Repeated inserts between the same two neighbors will eventually run into
  IEEE-754 double precision (not infinite), at which point `nextPosition`
  would produce two equal or misordered floats and `moveCard` would surface
  `InvalidNeighborOrderError` as the existing `"generic"` error code — this
  ticket doesn't add a re-spacing pass for that; flagged as a pre-existing
  gap in `lib/boards/positioning.ts`'s own scope, not introduced here.

### Verification — what was and wasn't run

Unit-tested: `applyCardMove` (8 cases: same-column reorder, end-of-column,
cross-column, empty-column target, negative-index clamp, missing-card
no-op, missing-column no-op, non-mutation of untouched columns/input) and
the full existing suite (typecheck/lint/build all green). **Not run: a real
browser + real Supabase drag-persist-across-refresh check.** This dev
machine has no Docker/local Supabase (documented constraint, `CLAUDE.md`),
so there is no way to sign in or fetch a real board here — the same gap
every prior Phase 3 round hit. `BoardView.md`'s own mouse/keyboard drag
verification (against a Ladle story with a stubbed `onMove`) still holds
for the *mechanics* of dragging itself, unchanged by this ticket; what
remains genuinely unverified in a live environment is specifically: (1) a
drag survives a hard refresh, (2) a keyboard-driven move persists the same
as a mouse one, (3) the rollback message actually appears against a real
failed request (e.g. RLS-denied or network-down), (4) the two-quick-drags
queueing behaves as reasoned above under real network latency instead of
synchronous test promises. A future ticket/CI run needs to close this gap
the same way `BoardView.md` flagged its own mobile-long-press gap.
