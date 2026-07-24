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
