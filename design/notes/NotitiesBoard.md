# /notities page (`page.tsx` + `NotitiesBoard.tsx`)

- **Code:** `app/(app)/notities/page.tsx` (Server Component, fetch + sort/q
  searchParams), `notes-data.ts` (server-only data resolution, board OR
  search), `NotitiesBoard.tsx` (`"use client"`, owns `renderItem`/header/
  navigation/drag/search), `loading.tsx` (Suspense fallback),
  `lib/notes/timestamp.ts` + `lib/notes/sort.ts` + `lib/notes/search.ts`
  (pure helpers).
- **Node IDs (fetched via the `figma-console` bridge, `figma_execute` +
  `getVariableByIdAsync` for every binding — never inferred from a resolved
  value):** section `3934:32790` (map entry, the stable anchor), desktop
  `Main/Desktop` `4067:18615`, mobile `Mobile/Notes/Overview` `4067:18157`,
  header `4067:19270` ("Knoppen", desktop) / `4067:19271` ("Knoppen",
  mobile), mobile sidebar-open button `4067:18159`. `BoardView`/
  `CardContainer`/`Card` node ids already live in their own files, not
  repeated here. `Card-content/Note` (`4067:18495`) is #229's, documented in
  `design/notes/CardContentNote.md`. #231's own search nodes are listed in
  that section below, not repeated here.

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

Implemented as **two real `Button` elements** for Sorteer (one icon-only
branch with `aria-label`, one labelled branch), not one `Button` whose text
is hidden with CSS at `md:`. Considered and rejected: passing
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

**#263 fix — visibility moved off the `Button` onto a wrapping `span`.** The
original build put `className="md:hidden"` / `className="hidden
md:inline-flex"` directly on each `Button`, and on mobile *both* rendered:
`Button.tsx`'s `cva` base class hardcodes `inline-flex` (line 25), and `cva`
only concatenates classes — it never merges/dedupes conflicting utilities the
way `tailwind-merge` would. In the compiled stylesheet `.inline-flex` is
declared after the bare `.hidden` (measured offsets in
`.next/static/css/*.css`: `.hidden` 13496, `.inline-flex` 13540), so on any
single element carrying both, `.inline-flex` always won — the labelled
button never actually hid on mobile. `md:hidden` on the icon-only branch was
unaffected, since Tailwind emits `md:` variants in a later block entirely,
past the bare-utility ties — which is exactly why only the *labelled*
button leaked through, not both, and why this only showed on mobile.
Fixed by wrapping each `Button` in its own `<span className="md:hidden">` /
`<span className="hidden md:inline">` and dropping the `className` from the
`Button` itself — same precedent this file's own "Search bar" section
already uses one component over (`<div className="hidden md:block
md:w-60 md:shrink-0">` wrapping `NotesSearchField`, never landing the
visibility class on the wrapped component's own props). Full incident
write-up: `docs/incidents.md`'s 2026-08-16 entry — this is a general `cva`
trap, not specific to this button, so the fuller reasoning lives there
rather than being duplicated per-component.

One consequence of the wrapper worth carrying: `shrink-0` came free while
the `Button` *was* the flex child of the header's actions row (it is in
`Button.tsx`'s own base class). The `span` is now that flex child, so it has
to re-declare `shrink-0` — without it the header can squeeze the sort button
on a narrow viewport, the same failure mode
`docs/open-questions.md#winkelmand-mobile-header-content-overflows-320px`
already records for another header. This applies to *any* wrapper added to
work around the `cva` trap above, not just this one.

## "Categorie" and the column pencil — wired in #232

Built #230 with the header's Categorie button and every column's pencil
button (`BoardView`'s `onEditColumn`) deliberately left as no-ops "met een
gemotiveerde keuze" (#230's own ticket text): `CategoryPanel`-equivalent UI
did not exist for Notities yet, and inventing one in #230 would have meant
freelancing #232's own scope.

**#232 wired both** to one category panel (a Notities-owned copy of
`/recepten`'s panel at the time; since #287 the shared
`components/organisms/CategoryPanel.tsx` configured with
`NOTE_CATEGORY_ICONS` and the `components.noteCategoryPanel`/`notes.errors`
namespaces; full reasoning, icon set, delete-flow precedent:
`design/notes/CategoryPanel.md`). One `categoryPanel` state (`{ open, target }`) owns
both triggers, same convention `ReceptenBoard.tsx`'s own `panel` state
already uses for the identical two-trigger shape. Both buttons already
carried real, translated `aria-label`s (`Categorie`) even while inert —
that part is unchanged.

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

## Search bar — built #231

Confirmed both fetched header frames genuinely include a search element in
the header zone #230 left room for:

- **Desktop** (`4067:19270`): the third child of "Knoppen," a 240×48
  "Container" node — a detached, hand-rebuilt `Input-field`-shaped assembly
  (`Icon/Search` + placeholder "Zoeken"), NOT a real component instance.
  Its own `Slot` nests a second, hidden (`visible: false`) "Categorie"
  `Button/Default` instance — confirmed leftover copy-paste residue, never
  rendered, not a real third trigger. Full measurement writeup:
  `docs/open-questions.md#notes-desktop-searchfield-detached`.
- **Mobile** (`4067:18157`): a separate, full-width real `Input-field`
  instance (`4067:18163`, "Zoeken" placeholder, `Title:false` — no visible
  field label) sits as its own row between the header and the board content,
  not nested inside the button group the way desktop's is. Its "Selected"
  variant (`4067:19525`, sample content "Honden") is the state the
  SearchResults/NoResults mock frames actually show while a query is typed:
  leading `Icon/Search` unchanged, a real trailing `Icon/X` appears (hidden
  entirely, not just swapped, when `Trailing-icon:false` — confirmed via
  `componentProperties`, not inferred from a resolved boolean).

**Node measurements (2026-08-13, `figma-console` bridge, `boundVariables`
+ `componentProperties` on every node below — never inferred from a
resolved value):**

| Node | What | Confirms |
| --- | --- | --- |
| `4067:18163` | mobile empty field | `Container` gap-stack-md/p-component-xs/rounded-control-outer/surface-highlight-white/stroke-primary-default — same tokens `InputField.tsx` already uses. `Trailing-icon:false` hides the whole `Trekking-icon-container`, not just the icon. |
| `4067:19525` | mobile "Selected" field | Same Container tokens, stroke swaps to `stroke-primary-selected`. `Trailing-icon:true`, swapped to `Icon/X`. |
| `4109:16063` | desktop detached frame | Container tokens byte-identical to the mobile instance (see open-questions slug) — the ONE number with no mobile equivalent to cross-check is its own 240px width (`w-60`, exact Tailwind step). |
| `4067:19985` | `SearchResults` list | `FILL` width, `HUG` height, `gap-stack-sm` (8px) between two `Card` instances — no `CardContainer`, no column chrome, confirming the ticket's "platte lijst" instruction structurally, not just by reading the ticket text. |
| `4067:19998` | "Geen resultaten gevonden" text | `text-base font-semibold text-text-secondary` (fontSize `font/size/base`, weight `font/weight/semibold`, fill `color/text/base/secondary`) — a direct Tailwind-native pairing, no custom styling. |
| `4067:19901`/`4067:19900` | NoResults "Main" frame | Confirms the full `PageHeader` (title + Sorteer + Categorie) AND the search field both stay mounted/visible during search — only the body content below switches. Its own `itemSpacing` (24, between header/field/message) is genuinely **unbound** in this specific node — see "Vertical spacing" below for why that's not a `spacing-flag` case. |

**Vertical spacing reuses `main`'s existing `gap-page-stack`, not a new
token.** The NoResults "Main" frame's own 24px gap between its stacked
children (sidebar-button+header row, search field, message) has no bound
variable on THIS node — but `AppShellNav.tsx`'s `<main className="... gap-
page-stack ...">` already puts that exact 24px gap between every one of
its own direct children (`PageHeader`, and now this ticket's mobile search
row and content wrapper are further direct children of the same `main`,
via `NotitiesBoard`'s returned fragment). Reusing the app's own existing
layout-level gap for a layout-level concern the fetched node's raw geometry
also happens to match is not the same class of inference the "resolved
value never identifies a token" rule warns against (that rule is about a
*component's own* Figma-bound styling, e.g. reading `border-input-hover`
off a pixel match) — this is "don't add a redundant new gap when the page
shell already produces the right one," and it means zero new spacing
classes/tokens were needed for the vertical rhythm between the header, the
mobile search row, and the content block below.

## Data: `NotitiesPageData`, one loader, not two

`notes-data.ts`'s `loadNotitiesPageData` (unchanged name, extended
signature: `(sortParam, queryParam)`) now returns a discriminated union,
`{ mode: "board"; categories; sort } | { mode: "search"; query; results }`.
Chosen over the ticket's other offered option (a second, parallel loader)
because `?q=` and `?sort=` are resolved at the exact same call site
(`page.tsx`) from the exact same `searchParams` object — splitting into two
functions would just relocate the `if` into `page.tsx` instead of removing
it, and `page.tsx` would still need to pick which loader to call based on
the same `q` check either way. `?q=` wins outright once it clears
`lib/notes/search.ts`'s `effectiveNotesSearchQuery` threshold: `sort` is
not read at all in the search branch (not silently dropped — structurally
absent from that branch's return type), because search results are always
recency-ordered (`searchNotes`' own `updated_at` ordering,
`lib/notes/queries.ts`, unchanged since #228) with no category grouping to
sort within.

`NotitiesBoard.tsx` receives this union as a single `data` prop rather than
the previous `categories`/`sort` pair — React hooks can't conditionally
call `useState`/`useEffect` based on `data.mode` (it changes across
navigations, same component instance), so the board-only local state
(`localCategories`, `pendingMoves`, `moveQueue`) is still declared
unconditionally, just initialized/synced from `data.categories` only when
`data.mode === "board"` (an empty array the rest of the time, unused since
`BoardView` isn't rendered in search mode).

## Search: query lives in `?q=`, debounce + `useTransition`, no new loading state

**Decisions, as the ticket asked to make and motivate:**

- **`?q=` is a URL searchparam**, exactly like the existing `?sort=` — not
  local-only client state. Same reasoning `?sort=` already has: shareable,
  server-renderable, and it lets `searchNotes` (already built by #228,
  `lib/notes/queries.ts`, no `"use server"` wrapper) be called directly from
  `notes-data.ts` server-side, rather than needing a new server action +
  client fetch round trip the way `IngredientSearchPanel.tsx`'s panel-local
  search does (a deliberately different shape there — a transient panel, not
  a page's own primary view).
- **Minimum query length: 2** (`lib/notes/search.ts`'s
  `NOTES_SEARCH_MIN_QUERY_LENGTH`). A single character against
  `ilike '%x%'` over every note's title + content_text returns near-random
  matches for almost no typed intent; 2 already narrows meaningfully and
  still feels instant. No design source — the ticket left this number to
  this ticket's own call. Below the threshold the page behaves exactly as
  if there were no query at all (board stays/reappears, no navigation is
  even scheduled once the debounce fires and finds the effective query
  unchanged from what's already committed — see `handleQueryChange`).
- **Debounce: 300ms** (`NOTES_SEARCH_DEBOUNCE_MS`), the same codebase
  default `IngredientSearchPanel.tsx`'s `SEARCH_DEBOUNCE_MS` already uses
  (no design source there either — reused for consistency, not re-derived).
- **No new loading state, per the ticket's own steer** ("het ontwerp toont
  geen laadtoestand"). `router.replace` is wrapped in `startTransition`
  (`useTransition`), which is what keeps the PREVIOUS server-rendered tree
  mounted (no Suspense-fallback flash back to `BoardSkeleton`) while the new
  `?q=` response streams in — the standard Next.js App Router pattern for
  search-as-you-type over server data. `replace`, not `push`: every
  keystroke would otherwise spam browser history the way `goWithSort`'s
  explicit `push` intentionally does for a real sort choice.
- **`goWithSort` now preserves `?q=`** (merges into the current
  `useSearchParams()` instead of hardcoding a bare `?sort=` string) — a
  small, ticket-motivated fix: without it, picking a sort option while a
  search is active would silently wipe `?q=` and dump the user out of
  search, even though `sort` has zero effect on search-mode rendering
  (see "Data" above). Harmless to keep both params present simultaneously;
  `sort` simply sits inert in the URL until the user clears the search.

**Animation.** One CSS crossfade (`transition-opacity duration-[var(--
duration-base)] ease-base motion-reduce:transition-none` — the exact class
string `BoardView.tsx`/`Dropdown.tsx`/`SidePanel.tsx`/
`AnimatedAddToBasketButton.tsx`/`ButtonToggle.tsx` already use, confirming
`prefers-reduced-motion` is respected the same way everywhere else in this
codebase) wraps whichever content is currently rendering (board, results,
or no-results — one toggle covers all three, not three separate
transitions). Driven entirely by derived state, no manual
setTimeout-choreographed fade sequence:

```
committedQuery = data.mode === "search" ? data.query : ""   // what the server actually rendered
effectiveQuery = effectiveNotesSearchQuery(queryInput)        // what's currently typed, thresholded
contentVisible = effectiveQuery === committedQuery
```

The instant a keystroke makes `effectiveQuery` diverge from `committedQuery`
(including "typed something too short to search" only if that also changes
the effective value — e.g. going from a committed 3-char query back to 1
character DOES diverge, since the effective value drops to `""`), the
wrapper's opacity drops to 0 — the fade-out fires on the very first
keystroke that would actually change what's showing, matching the ticket's
"iemand begint met typen > carousel fade uit." It stays invisible (old
content still mounted underneath, not blanked) for however long the
debounce + server round trip takes — no spinner is ever drawn in that gap,
per the ticket's own instruction. Once the response lands and
`committedQuery` updates to match, `contentVisible` flips back to `true`
purely because the two values now agree again — the fade-in requires no
separate "did new data arrive" bookkeeping. Clearing via the X button sets
`queryInput` to `""` immediately (diverges from a non-empty
`committedQuery` → fade-out) and skips scheduling if there's nothing to
clear; the subsequent navigation removes `?q=` entirely, `committedQuery`
becomes `""` too, and the board fades back in — exactly the ticket's third
beat.

**One deliberate deviation from the ticket's literal storyboard**: a
single keystroke that stays below `NOTES_SEARCH_MIN_QUERY_LENGTH` while the
board is already showing does **not** fade anything (both `effectiveQuery`
and `committedQuery` are `""`) — the fade cascade is gated on a genuine
search-state transition, not on the raw act of typing. This was chosen
over fading on every keystroke unconditionally because the latter would
flicker the board for up to a full debounce window on nearly every attempt
to start a real search, with nothing yet to show for it.

## Scope boundary: textual search only

`searchNotes` is `ilike`/`pg_trgm`-based text matching over `notes.title` +
`notes.content_text` (#228, unchanged by this ticket). Semantic search via
pgvector is explicitly **Phase 8** (#31) — already-assigned future work,
not an open question this ticket leaves behind.

## Search field: `NotesSearchField`, one component two placements, built on `InputField`

Private (unexported) component inside `NotitiesBoard.tsx` — not a new
`components/atoms|molecules` entry, since the search bar has no distinct
Figma component of its own (both fetched nodes are either a detached frame
or a plain `Input-field` instance override, see "Search bar" above); same
"page-specific composition stays local" precedent `NotitiesBoard.tsx`'s own
Sorteer-dropdown markup already sets. Rendered twice — desktop (wrapped in
a `hidden md:block md:w-60 md:shrink-0` sizing div, since `InputField`'s
own root hardcodes `w-full` and a caller-supplied `w-60` on the SAME
element would create two conflicting width utilities with no guaranteed
winner; wrapping avoids that entirely) inside `PageHeader`'s `actions`, and
mobile (`className="pr-page-right-equal md:hidden"`, matching the fetched
instance's own measured outer padding — `main` only supplies left padding,
every full-width row supplies its own right edge, same as `PageHeader.tsx`
itself) as its own row directly below `PageHeader`. Two literal JSX
branches (query present vs. not) rather than a conditionally-spread prop
object, for the same reason the Sorteer button above already needs two real
`Button` branches: `InputField`'s `onTrailingIconClick`/`trailingIconLabel`
are a paired discriminated union (see `design/notes/InputField.md`'s #231
entry), not two independently-optional props a ternary-spread could satisfy
cleanly.

No visible `label` is passed to `InputField` (placeholder-only, matching
the fetched node's own `Title:false` and this exact codebase's own
precedent, `IngredientSearchPanel.tsx`'s identically-placeholder-only
search field).

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

**#231 additions**: `components.pageHeader.notes.searchPlaceholder`
("Zoeken"/"Search"), `components.pageHeader.notes.searchClearLabel` (the
clear/X button's `aria-label`), `notes.search.noResults` ("Geen resultaten
gevonden"/"No results found").

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
**Corrected 2026-08-13 (during #232):** this section originally claimed the
schema had "never been applied to the hosted database at all". That was true
when #230 was written and is now false — `deploy.yml` ran on the user's
explicit approval (ADR-0012) later the same day and applied both
`20260813000001_note_schema` and `20260813000002_move_note_rpc`, verified
against the hosted `supabase_migrations.schema_migrations` rather than
assumed. So the gap here is now exactly `ReceptenBoard.md`'s/
`TeDoenBoard.md`'s standing one (real tables, no local way to sign in), not
a stronger one. One thing that *will* look broken and is not:
`seed_default_note_categories()` is an `after insert on auth.users` trigger,
so it never fired for the two pre-existing accounts — they have zero
`note_categories` rows, and `/notities` therefore renders with no columns
until a category is created through #232's panel. Everything
above is reasoned from reading `lib/notes/queries.ts`/`actions.ts` (#228,
already merged) and typechecked/unit-tested against them — the query
shapes, the RPC error-code mapping, and the optimistic-update math are
exercised by `tests/notes-sort.test.ts`/`tests/notes-timestamp.test.ts`/
the existing `tests/notes-document.test.ts`, not by a live request. The
migration workflow has since run, so what is owed is no longer a deploy but
a **signed-in visit to production** — re-verify exactly the way
`BoardView.md`'s own device-verification entries describe: real drag, real
sort navigation, real note creation, on real data.

**#231 adds the same gap for search, plus one of its own.** `pnpm lint`/
`typecheck`/`test`/`check:server-only`/`check:raw-spacing`/
`check:comment-budget`/`build` all run and green (see the PR for exact
output) — real search, the debounce timing, and the fade animation were
never exercised in a live browser against real rows, same standing gap as
above. **New this ticket**: `NotitiesBoard.tsx` (like `ReceptenBoard.tsx`/
`TeDoenBoard.tsx` before it) has no Ladle story of its own — it's a client
component requiring `next/navigation`'s router/searchParams hooks, which
Ladle's plain-React preview can't provide. The three search UI states are
therefore only *partially* covered by `pnpm test:visual`: `InputField`'s
updated/expanded story (`ClearableSearch`) baselines the field itself
(empty + typed-with-clear-button, including the new hover/active tokens),
and `Card`/`CardContentNote`'s existing stories already baseline the
results-row look (byte-identical composition, just stacked flat instead of
inside a column). The assembled page states (search results list live
alongside the real header, and the no-results message) are verified by
reading `NotitiesBoard.tsx` + running the full gate suite, not by an
independent screenshot baseline — flagged here rather than silently
claimed as fully visually verified.

## 2026-08-18 — Sorteer dropdown moved onto the shared popover positioner

One of the seven call sites of `lib/dom/use-popover-position.ts` — not
either of the two reported off-screen bugs, converted alongside them since
it's the same hand-rolled pattern as `WinkelmandList.tsx`'s Sort menu.
`top-full right-0 mt-2` → the hook, `anchor="right"`, `prefer="below"`,
unchanged designed placement. Full mechanism: `docs/incidents.md`
(2026-08-18).
