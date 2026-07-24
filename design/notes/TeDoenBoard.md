# /te-doen page (`page.tsx` + `TeDoenBoard.tsx`)

- **Code:** `app/(app)/te-doen/page.tsx` (Server Component), `app/(app)/te-doen/TeDoenBoard.tsx` (client wrapper)
- **Node IDs:** `3680:1442` (desktop filled), `3680:1435` (mobile filled), `3670:1696` (Card-content/Ticket) — same nodes `BoardView.md`/`CardContentTicket.md` already document; this file only records the page-level wiring decisions, not component structure already recorded there.

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

## "Active board" = favorite board (until #95)

There's no board switcher or `[boardId]` route yet. `page.tsx` takes
`getBoardsForUser()`'s first row — that query already sorts favorite-first,
then by `position` — and fetches that board's full column/card tree via
`getBoardWithColumns`. #95 (board switcher) replaces this with a real
`[boardId]` param; until then this is the only sensible reading of "the
active board" and is called out here and in `design/notes/BoardView.md` so
#95 knows what it's replacing.

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

- Board switcher, favourite toggle, sort (#95) — `PageHeader`'s slots stay
  the same inert buttons the #88 stub already had.
- `onMove`/`onEditColumn` are still left unset on `BoardView` — drag
  persistence is #96, column rename has no UI yet either.

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
