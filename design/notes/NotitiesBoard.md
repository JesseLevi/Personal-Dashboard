# /notities page (`page.tsx` + `NotitiesBoard.tsx`)

- **Code:** `app/(app)/notities/page.tsx` (Server Component, fetch + sort
  searchParam), `notes-data.ts` (server-only sort/data resolution),
  `NotitiesBoard.tsx` (`"use client"`, owns `renderItem`/header/navigation/
  drag), `loading.tsx` (Suspense fallback), `lib/notes/timestamp.ts` +
  `lib/notes/sort.ts` (pure helpers).
- **Node IDs (fetched via the `figma-console` bridge, `figma_execute` +
  `getVariableByIdAsync` for every binding — never inferred from a resolved
  value):** section `3934:32790` (map entry, the stable anchor), desktop
  `Main/Desktop` `4067:18615`, mobile `Mobile/Notes/Overview` `4067:18157`,
  header `4067:19270` ("Knoppen", desktop) / `4067:19271` ("Knoppen",
  mobile), mobile sidebar-open button `4067:18159`. `BoardView`/
  `CardContainer`/`Card` node ids already live in their own files, not
  repeated here. `Card-content/Note` (`4067:18495`) is #229's, documented in
  `design/notes/CardContentNote.md`.

Built #230. Not a new organism: composes the existing `BoardView`
(`components/organisms/BoardView.tsx`) with `renderItem` -> `CardContentNote`
(#229), exactly as `/recepten` (#124) and `/te-doen` (#93) already do. Header
+ board live in one client file, like `ReceptenBoard.tsx` and unlike
Te-Doen's `TeDoenHeader`/`TeDoenBoard` split — see the header section below
for why.

## Server/client split

Same reasoning as `ReceptenBoard.md`/`TeDoenBoard.md`: `BoardView`'s
`renderItem` is a function prop, not serialisable across the Server->Client
boundary. `page.tsx` fetches `CategoryWithNotes[]` (`lib/notes/queries.ts`'s
`getNoteCategoriesWithNotes`, #228) plus the resolved sort, and hands only
that plain data to `NotitiesBoard.tsx`.

`?sort=` is read in `page.tsx`'s default export, *outside* the `<Suspense>`
boundary — same shape `app/(app)/te-doen/page.tsx` uses — because resolving
the searchParam is cheap and synchronous-ish (no DB round trip), while
`loadNotitiesPageData` (the actual `getNoteCategoriesWithNotes` fetch) is the
part that benefits from streaming behind the shell, so only that half is
wrapped.

## Header: two real buttons, not one CSS-hidden one

Fetched `4067:19270` (desktop) has three children in its "Knoppen" row,
itemSpacing 20 (`spacing/inline/gap-xl`, confirmed via `boundVariables`):
Sorteer (`Button/Default`, `Style=Filled`, `Icon=Arrow-up-down`, `With
text=true`, 120×40), Categorie (`Button/Default`, `Icon=Plus`, `With
text=true`, 120×40), and a third "Container" node (240×48 search-input
assembly, see "Search bar" below). Fetched `4067:19271` (mobile) has the
same two action buttons at itemSpacing 8 (`spacing/inline/gap-sm`) but
**Sorteer alone drops to `With text=false`** (40×40, icon-only) — Categorie
keeps its visible text at both breakpoints (125×40 on mobile). This matches
the ticket's own text exactly ("Sorteren... mobiel toont het ontwerp alleen
het icoon"; nothing said about Categorie going icon-only, and the fetched
node confirms it doesn't).

Implemented as **two real `Button` elements** for Sorteer (one
`className="md:hidden"` icon-only branch with `aria-label`, one
`className="hidden md:inline-flex"` labelled branch), not one `Button` whose
text is hidden with CSS at `md:`. Considered and rejected: passing
`children={<span className="hidden md:inline">{label}</span>}` into a single
`Button` call. That would have worked visually (a `display:none` flex child
contributes no box and no `gap`, so the button would shrink to icon+padding
on mobile) but it fights `Button.tsx`'s own discriminated union — the
labelled branch (`children: ReactNode`) and the icon-only branch
(`children?: never; "aria-label": string`) each already model one of these
two *real, Figma-distinct* button instances (120×40 vs 40×40 are different
components in the file, not one component with a CSS trick), so using each
branch as designed is the more literal translation, not a workaround. The
gap between Sorteer and Categorie itself is responsive too
(`gap-inline-sm md:gap-inline-xl`), matching the two measured itemSpacing
values above — both are real tokens already in `app/theme.css` (#205/#218
already added `gap-inline-sm`/`gap-inline-xl`), so nothing needed a
`spacing-flag`.

## "Categorie" — a deliberate no-op, and so is the column pencil

The ticket allows wiring the header's Categorie button as a no-op "met een
gemotiveerde keuze" until #232 (category management) lands. Rationale:
`CategoryPanel`-equivalent UI does not exist for Notities yet, and inventing
one here would mean freelancing #232's own scope. Same reasoning extends to
every column's pencil button (`BoardView`'s `onEditColumn`) — left entirely
unpassed (`undefined`), so `CardContainer` renders it as inert chrome (its
`onEdit` prop is optional; see `CardContainer.tsx`), exactly the same
"fixed chrome, no handler yet" shape `PageHeader.md` already documents for
Te-Doen's pre-#95 Chevron/Star buttons. Both buttons carry real,
translated `aria-label`s (`Categorie`) regardless — inert is not the same
as inaccessible.

## Sort: `lib/notes/sort.ts`, two note-relevant options only

New module, same shape and same "sort never touches `position`, it only
reorders an already-fetched array in memory" split as `lib/boards/sort.ts` —
see that file's own header comment, not repeated here. Only
`createdAt`/`alphabetical` exist (`NOTE_SORT_OPTIONS`): a note has no
priority/size axis the way a Te-Doen card does, and the ticket explicitly
scopes the dropdown to "alleen notitie-relevante opties." `notes.created_at`
did not previously reach the client — `NoteSummaryRow`
(`lib/notes/types.ts`) and `getNoteCategoriesWithNotes`'s select
(`lib/notes/queries.ts`) both gained it in this ticket (the column already
existed on `public.notes`, #225's migration; #228 simply hadn't needed it
yet). `searchNotes`'s own select (`RawNoteSearchRow`) also gained it, purely
to keep satisfying the now-wider shared `NoteSummaryRow` return type (a real
compiler error otherwise, not a style choice) — its own ordering stays
`updated_at`-only, unchanged; #231's flat, recency-ordered result list still
has no created-date sort to expose.

`dragDisabled={sort !== null}` on `BoardView`, same precedent
`design/notes/TeDoenBoard.md`'s `#95` section already established and this
ticket's own instruction repeats: a drop's resulting index is meaningless
against the stored `position` once the on-screen order is a sort, not the
manual order.

Tests: `tests/notes-sort.test.ts` (mirrors `tests/boards-sort.test.ts`'s
shape: option validation, each sort key, no-mutation, `null` passthrough).

## Drag & drop: `moveNote`, the RPC #228 already chose

Persisted via `moveNote` (`app/(app)/notities/actions.ts`, already built by
#228 — `public.move_note`, ADR-0015). Optimistic apply/revert machinery is
`applyItemMove<NoteSummaryRow, "notes", CategoryWithNotes>` (the same
generic #155 introduced in `lib/boards/optimistic.ts` for Recepten), keyed on
`"notes"` — a `note_categories` row has no further "board" wrapper the way
`BoardWithColumns` does, same as a `recipe_categories` row. `pendingMoves` is
a count, `moveQueue` serializes the network calls one at a time, no
`router.refresh()` on success — all identical reasoning to
`ReceptenBoard.md`'s own `#155` section, not re-derived here.

## Navigation — two build decisions, both flagged per the ticket

- **Card click -> `/notities/[noteId]`** via `onItemClick`. Figma draws no
  prototype link from the overview to an editor — same "this ticket's own
  reading of the composition" call `ReceptenBoard.md` records for
  `/recepten/[recipeId]`.
- **Column "+" creates a new empty note in that category, then navigates
  straight to its editor.** This one is not just a convenient default — the
  ticket states it as the *only* place a note can originate, since the
  editor itself draws no category picker. `createNote` (#228) already
  returns the full `NoteRow` including its new `id`; `handleAddNote` awaits
  it and calls `router.push`.

`/notities/[noteId]` (#233) does not exist yet. Linking to it anyway is
fine — `pnpm build` doesn't require the target route to exist — same
precedent `ReceptenBoard.md` records for `/recepten/[recipeId]` pre-#127,
confirmed again here by running the full gate suite below. **What #233 needs
to pick up from here:** a note created via the column "+" already has a
category (set at creation) and an empty-but-valid `content` doc (#228's
migration default) — the editor route only needs to load it by `id` (`
lib/notes/queries.ts`'s `getNote`) and call `updateNoteContent` on save; no
further wiring is expected from this ticket's side.

## Empty state — Te-Doen/Recepten's shape reused, no Figma reference of its own

`CardContainer`'s `emptyState` prop needs no change here — an empty
category renders the same centered `Button variant="white" icon="Plus"`
sourced from `components.cardContainer.addItemLabel`, exactly as
`ReceptenBoard.md`'s own "Empty state" section already documents for
Recepten. No Notities-specific `EmptyState` node was fetched (none exists —
same absence `ReceptenBoard.md` found) — this is a deliberate reuse of a
shape with no Notities Figma reference behind it, not a fresh design read.

## Column icon — same free-text-vs-`IconName` gap as every other board

`note_categories.icon` is DB `text`, validated only via the existing
`isIconName` runtime guard (`components/atoms/Icon.tsx`), same gap
`recipe_categories.icon`/`board_columns.icon` already have
(`ReceptenBoard.md`/`TeDoenBoard.md`). Fallback is `"Notebook"` — the icon
`Sidebar.tsx`'s own `NAV_ITEMS` already assigns to the whole Notities
section, a neutral glyph with no category-specific meaning, same reasoning
`FALLBACK_CATEGORY_ICON` uses `"FolderClosed"` for Recepten.

## Timestamp helper: `lib/notes/timestamp.ts`

Built per the ticket's explicit extra task — #229 specified the three-tier
fallback (today -> `HH:MM`, yesterday -> the word "Gisteren", older ->
`dd-mm-yyyy`) and deliberately left it unbuilt for whichever of #230/#231
landed first (`CardContentNote.md`'s "Date-formatting helper" section).

**Discriminated result, not a translated-string parameter — the choice the
ticket asked to be made and motivated.** `formatNoteTimestamp` returns
`{ tier: "today"; time }` / `{ tier: "yesterday" }` /
`{ tier: "older"; date }`. The caller (`NotitiesBoard.tsx`'s
`formatTimestamp`) supplies the translated word only for the `"yesterday"`
tier, via `useTranslations("notes.timestamp")`'s `yesterday` key (new,
both catalogs). Rejected alternative: `formatNoteTimestamp(iso, now,
translatedYesterday: string)`, threading the word in as a parameter. Reasons
for the discriminated result instead:

1. **Every other pure `lib/` helper in this codebase is i18n-free** —
   `nextPosition`, `sortCardsForView`/`sortNotesForView`, `deriveTitle`/
   `toPlainText`. Taking a pre-translated string as an argument would make
   this the one exception, coupling a framework-free module's signature to
   next-intl's calling convention (the caller must resolve the string
   *before* calling, even on the two tiers — today, older — that never use
   it).
2. **Testability**: `tests/notes-timestamp.test.ts` asserts on the tier +
   raw value directly (`{ tier: "yesterday" }`), with zero i18n setup —
   matching `tests/notes-document.test.ts`'s/`tests/boards-sort.test.ts`'s
   own zero-dependency shape. A string-parameter design would need every
   test to invent and pass a fake translated word, testing string-passthrough
   plumbing instead of the actual date-boundary logic.
3. **"Which tier" and "what word" are genuinely different concerns** — the
   first is a pure date computation, the second is locale content. Keeping
   them separate means a future locale's own word ordering/grammar
   (`notes.timestamp.yesterday`) can change without touching this module at
   all.

**No `Intl`/locale-aware formatting for `time`/`date`.** The ticket names two
literal shapes (`HH:MM`, `dd-mm-yyyy`), not a locale-varying one, and this
app has exactly one active locale today (`i18n/request.ts`, hardcoded
`"nl"`). Manual `padStart` formatting was used instead of `Intl.DateTimeFormat`
— simpler, and avoids a locale argument this module has no real second value
for yet. Flagged, not silently limited: if a second locale ever ships,
`dd-mm-yyyy` (day-first) is a Dutch convention, not a universal one — this
module would need a locale parameter at that point. Not blocking now (no
open question filed — this is a stated, deliberate scope limit tied to
"exactly one locale exists," not a design gap).

**Calendar day, local time, not UTC.** `formatNoteTimestamp` is called from
`NotitiesBoard.tsx` (`"use client"`), so `new Date()`/`getFullYear()`/
`getMonth()`/`getDate()` all resolve in the *browser's* local timezone — the
correct one for "did the user open this note today," unlike a server-side
UTC comparison which could misclassify a note edited late at night as
"yesterday" prematurely or vice versa depending on the reader's timezone.

**Which field feeds the card**: `note.updated_at`, not `created_at` — the
card timestamp reads as "last edited," matching every sampled Figma instance
(`4067:19048`) showing varied timestamps across otherwise-identical note
cards, which only makes sense as an edit time (a freshly-created empty note
and a heavily-edited one from the same session would share a `created_at`
otherwise). `created_at` is reserved for the Sorteer dropdown's "Aanmaakdatum"
option instead — a real, distinct field, not a proxy for the same thing.

Tests: `tests/notes-timestamp.test.ts` (today, yesterday, older, both
calendar-day boundaries, a month rollover, a year rollover, single-digit
padding).

## Search bar — confirmed present in Figma, `#231`'s to build, room left per the ticket

Both fetched header frames genuinely include a search element **in the same
header zone** the ticket says to plan for:

- **Desktop** (`4067:19270`): the third child of "Knoppen," a 240×48
  "Container" node — an `Input-field`-shaped assembly (`Icon/Search` +
  placeholder "Zoeken") whose own `Slot` nests **a second, distinct Button/
  Default instance also reading "Categorie"** (125×40). This second
  Categorie button is very likely further copy-paste residue (the same class
  of artifact `notes-overview-duplicate-mobile-frame` and Recepten's un-
  renamed 4th column already are) rather than an intentional third
  "Categorie" trigger — but confirming that one way or the other is a call
  for whoever builds #231 against the search node directly (measuring
  annotations, not just geometry), not this ticket's to resolve or silently
  drop.
- **Mobile** (`4067:18157`): a separate, full-width `Input-field` instance
  (`4067:18163`, "Zoeken" placeholder) sits as its own row between the
  header and the `Carousel`, not nested inside the button group the way
  desktop's is.

**Nothing from either search node is rendered by this ticket** — no
placeholder `<input>`, no reserved empty box. Building any part of a search
field now would mean guessing at behaviour (`#231`'s own scope: live query,
debounce, results list shape, the flat-list-no-grouping read
`lib/notes/queries.ts`'s `searchNotes` already implements) ahead of that
ticket. What *is* already true, and is what "leave room for it" means in
practice: the header's `actions` slot is a plain flex row
(`PageHeader.tsx`'s existing `actions` prop, untouched), so #231 can add a
third flex child (desktop) or its own full-width row below the header
(mobile, matching the measured Figma position) without restructuring
anything this ticket built. No layout decision here is load-bearing against
a specific search-bar width or position — the row simply has space.

## i18n

New keys, both catalogs, identical key sets: `nav.notes` (Notities' fixed
page title — no board switcher exists here, so `title` is a translated page
label like Recepten's, not board data, same distinction `PageHeader.md`
already draws), `components.pageHeader.notes.{addCategoryLabel, sortLabel,
sortOptions.{createdAt,alphabetical}}`, `notes.timestamp.yesterday`. Category
names are `note_categories.name` **data**, never translation strings — same
reasoning `TeDoenBoard.md`/`ReceptenBoard.md` already document for
`board_columns.name`/`recipe_categories.name`. `addLabel`/`editLabel`/
`addItemLabel` are reused verbatim from `components.cardContainer.*`.

## Sidebar

`app/(app)/_components/AppShellNav.tsx`'s `ROUTES` map gained
`notes: "/notities"` — `Sidebar.tsx`'s `NAV_ITEMS`/labels already had a
`"notes"` entry (`Icon/Notebook`) since #88, just unrouted until now, so
`activeItemForPath` now correctly resolves Selected state on `/notities`
and hover-prefetch/click-navigate both work the same as the other three
routed items. No change to `Sidebar.tsx` itself.

## Manifest — deliberately not added

`page.tsx` carries no `metadata.manifest` export. #223's follow-up
(2026-08-13) built a per-page Web App Manifest + `route.ts` for Te-Doen,
Recepten and Winkelmand only — Notities already has its favicon/apple-icon
(#245/#246) but no `manifest.webmanifest` route file exists yet, and adding
one is not named in this ticket's scope. Flagged here rather than silently
matched to the other three pages' pattern, so it isn't mistaken for an
oversight.

## Verification — what was and wasn't run

`pnpm lint`/`typecheck`/`test`/`check:server-only`/`check:raw-spacing`/
`check:comment-budget` all run and green; `pnpm test:visual` run in full
(not scoped) — see the PR for exact output. **Not run: a real authenticated
`/notities` route in a browser, and no drag/sort/create-note flow against
real data.** Per `CLAUDE.md` this dev machine has no Docker/local Supabase.
Beyond that standing gap, this ticket sits on top of a schema that has
**never been applied to the hosted database at all** — #225's
`note_categories`/`notes` tables and #228's `move_note` RPC are committed
migrations, not yet run via the `workflow_dispatch` deploy workflow
(ADR-0012) or by hand. So unlike `ReceptenBoard.md`'s/`TeDoenBoard.md`'s own
gap (real tables, just no local way to sign in), there is currently no
environment anywhere, including production, where `/notities` could be
opened against live rows even if this dev machine had Docker. Everything
above is reasoned from reading `lib/notes/queries.ts`/`actions.ts` (#228,
already merged) and typechecked/unit-tested against them — the query
shapes, the RPC error-code mapping, and the optimistic-update math are
exercised by `tests/notes-sort.test.ts`/`tests/notes-timestamp.test.ts`/
the existing `tests/notes-document.test.ts`, not by a live request. A future
ticket that runs the migration workflow should re-verify this page exactly
the way `BoardView.md`'s own device-verification entries describe: real
drag, real sort navigation, real note creation, on real data.
