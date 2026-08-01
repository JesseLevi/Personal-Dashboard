# /recepten page (`page.tsx` + `ReceptenBoard.tsx`)

- **Code:** `app/(app)/recepten/page.tsx` (Server Component, fetch + header),
  `ReceptenBoard.tsx` (`"use client"`, owns `renderItem`/navigation).
- **Node IDs (fetched via MCP for #124):** `3761:5537` ("Pages/Recepten/
  Breakpoints" section, depth 3 — confirms `Main/Desktop` #3672:1577 ->
  `Main` #3672:1579 -> `Header` #3672:1580 + `Carousel` instance #3672:1588),
  `3672:1588` (the Carousel instance itself, depth 5 — the actual column
  data below). Header/PageHeader node ids are already recorded in
  `design/notes/PageHeader.md` (`3672:1580`); BoardView/CardContainer/
  Carousel node ids in their own files — not repeated here.

Built #124. Not a new Figma leaf component — same page-level-composition
precedent as `TeDoenBoard.tsx`/`TeDoenPageBody.tsx` (neither added to
`design/figma-map.json`). No new organism or atom: composes the existing
`BoardView` (`components/organisms/BoardView.tsx`) with `renderItem` ->
`CardContentRecipe` (`components/molecules/CardContentRecipe.tsx`, #19),
exactly as #28's breakdown specified.

## Server/client split

Identical reasoning to `TeDoenBoard.md`: `BoardView`'s `renderItem` is a
function prop, not serialisable across the Server->Client boundary.
`page.tsx` fetches `CategoryWithRecipes[]` (`lib/recipes/queries.ts`'s
`getRecipeCategoriesWithRecipes`, #122) and passes only that plain data to
`ReceptenBoard.tsx`.

## Columns: icon + count from the database, not hardcoded

`recipe_categories.icon` is DB `text` (schema deviation (a), same free-text-
vs-`IconName`-union gap `TeDoenBoard.md`/`CardContainer.md` already flag for
`board_columns.icon`) — validated with the same `isIconName` guard. The
seeded categories (`seed_default_recipe_categories()`,
`supabase/migrations/20260730000002_recipe_schema.sql`) are Ontbijt/
`Croissant`, Lunch/`Sandwich`, Avond/`Broccoli` — all valid `IconName`
members today. Card counts are `items.length` inside `BoardView`'s own
`CardContainer` composition (already built, #87/#90) — never a stored
count column, so they can never drift from the fetched `recipes` rows.

**Fallback icon is `FolderClosed`, deliberately not `Croissant`.** A
category whose `icon` string isn't a real `IconName` (reachable once #125
lets a user type an arbitrary value) needs *some* rendered icon rather than
crashing — but defaulting to `Croissant` (as `TeDoenBoard.tsx` defaults
unrecognised `board_columns.icon` to, for lack of a more neutral option in
that context) would be actively misleading here: it's a real, meaningful
icon for one specific category (Ontbijt), not a neutral placeholder.
`FolderClosed` is used instead — the same icon Figma's own Sidebar already
assigns to the whole Recepten section (`components/organisms/Sidebar.tsx`'s
`NAV_ITEMS`), a generic "recipe folder" glyph with no meal-time connotation.

## The fetched 4th column — confirmed copy-paste, not built

Re-fetching `3672:1588` (depth 5) independently confirms the ticket's own
claim: a 4th `Card-container` instance sits after Ontbijt/Lunch/Avond,
carrying `Icon/Cake-slice` (a 4th, distinct icon — not literally
`Icon/Croissant` again) but its `Name`/`Hoeveelheid` text nodes are left
un-overridden at the *base component's own default sample values*
("Ontbijt"/"4") rather than a real name like "Toetje"/"Dessert" — i.e.
someone duplicated the Ontbijt instance, swapped only the icon, and never
finished renaming it. `seed_default_recipe_categories()` only ever inserts
three categories. Not built; recorded at
`docs/open-questions.md#recipes-overview-duplicate-fourth-column`.

## Header "Categorie" button — wired by #125, and `PageHeader` moved here

**Superseded by #125.** The button is now wired: it opens `CategoryPanel`
(`./CategoryPanel.tsx`) in create mode. `PageHeader` itself moved from
`page.tsx` into this file in the same ticket — `page.tsx` now only fetches
data/translations and passes plain strings (`title`, `addCategoryLabel`)
down, same Server/Client split as before, just one file lower. Reason for
the move: the header's Plus button and every column's pencil button
(`BoardView`'s `onEditColumn`, wired below) both need to open the *same*
`CategoryPanel` instance — unlike Te-Doen's `TeDoenHeader.tsx`/
`TeDoenBoard.tsx` split (boards vs. cards, never sharing state), category
create and category edit are the same entity reachable from two different
triggers, so they need one shared `panel` state and one owner. Full panel
reasoning: `design/notes/CategoryPanel.md`.

## Empty state — Te-Doen's shape reused, no Figma reference of its own

`CardContainer`'s `emptyState` prop (#87) is already wired inside
`BoardColumnView` (`BoardView.tsx`) and needs no change here — an empty
category renders the same centered `Button variant="white" icon="Plus"`
Te-Doen's empty columns use, sourced from the same
`components.cardContainer.addItemLabel` key (`"Voeg item toe"`/
`"Add item"`) rather than a new Recepten-specific string, since the wording
is generic ("add item"), not recipe-specific. **Figma draws no empty state
for Recepten** (`3878:10175`, the only fetched `EmptyState` node, is
Te-Doen's) — this is a deliberate reuse of a shape with no Recepten Figma
reference behind it, not a fresh design read. `onAddItem` (the empty-state
and per-column "+" buttons — adding a *recipe*) is still left unset
(`undefined`) — #126 (add-recipe form) owns that wiring, out of scope here.
**`onEditColumn` is wired by #125**, opening `CategoryPanel` in edit mode
with the clicked column's `RecipeCategoryRow` looked up from `categories` by
id — the same `BoardColumnView`'s own `onEditColumn ? … : undefined` pattern
now has a real callback behind it instead of leaving the pencil button
inert.

## Navigation: card click -> `/recepten/[recipeId]`, a build decision

`onItemClick={(recipe) => router.push(`/recepten/${recipe.id}`)}` — Figma
draws no prototype link from the overview to a detail screen; this is this
ticket's own reading of "a recipe card should open its recipe," the same
kind of composition decision `TeDoenBoard.tsx` made for its card-detail
panel. `/recepten/[recipeId]` does not exist yet (#127) — linking to it
anyway is fine (`pnpm build` doesn't require the target route to exist) and
was confirmed by running the full gate suite below.

## Drag & drop: `dragDisabled`, not persisted — recipes have no `position`

**Decision: disabled.** `recipe_schema`'s own migration header states
plainly that "recipes are not reordered within a category in this phase's
design" — no `recipes.position` column exists at all, only `created_at`
(the query's own sort key, see `lib/recipes/queries.ts`). A drop's
`toIndex` would therefore have nothing real to persist against — the exact
"meaningless index" reasoning `TeDoenBoard.tsx` already uses to disable
dragging under an active sort (`design/notes/TeDoenBoard.md`).

**Alternative considered and rejected:** persist only the *cross-column*
half of a drag (call `updateRecipe({recipeId, categoryId: toColumnId})`,
silently drop `toIndex`) — `updateRecipe` (#122) already accepts a
`categoryId` field, so this is technically reachable without a new action.
Rejected because it would be a real, user-visible feature (moving a recipe
between meal categories by drag) built without a ticket asking for it, with
no optimistic-update/rollback UI (unlike `TeDoenBoard.tsx`'s `onMove`, which
has a full snapshot/revert/queueing story behind it) and no product sign-off
on whether silently discarding the drop's requested index is acceptable.
Out of scope for #124; a future ticket can build this properly if wanted.

## Search/filter — explicitly out of scope, not an open question

`Vision.md` names "search/filter by category or ingredient" as a core
Recepten action, but no search/filter UI is designed in this Figma file and
textual search is Phase 7 (pg_trgm, #31/#130's own note). This is a stated
scope boundary for #124, not a design gap — nothing is recorded in
`docs/open-questions.md` for it.

## i18n

New keys, both catalogs, identical key sets:
`components.cardContentRecipe.durationMinutes` (`"{minutes} min"` — same
value in both locales; Figma's own sample text is `"20 min"`, and Dutch
already abbreviates minutes the same way). Column names (Ontbijt/Lunch/
Avond) are `recipe_categories.name` **data**, never translation strings —
same reasoning `TeDoenBoard.md` already documents for `board_columns.name`.
`addLabel`/`editLabel`/`addItemLabel` are reused verbatim from
`components.cardContainer.*` (already existing, generic wording) — no new
keys needed for those.

## Thumbnail image — `recipes.thumbnail_path` is not read at all yet

`ReceptenBoard.tsx` never passes `imageUrl` to `CardContentRecipe` — the
molecule itself now renders a `bg-surface-muted` placeholder square when
`imageUrl` is absent (see `design/notes/CardContentRecipe.md`'s "#124"
entry for why that decision moved *into* the molecule rather than staying a
route-level stacking hack). **Stated plainly, not left implicit:** this
means every recipe's `thumbnail_path` is currently ignored outright, even a
recipe that has one stored — there is no code path in this ticket that
resolves a path to a URL at all. That's acceptable for now because #121
(the private `recipe-thumbnails` bucket) isn't built, and per
`Architecture.md` §7 a private bucket is only ever served via short-lived
signed URLs anyway — never a URL this client component could construct
itself even if the bucket existed. Wiring a real signed-URL resolver is
#121-and-later's job, not #124's; flagged at
`docs/open-questions.md#recipe-card-no-photo-placeholder` and here so it
isn't mistaken for an oversight. `duration` is omitted (not rendered) when
`recipes.time_minutes` is `null` — see the same `CardContentRecipe.md` note
for why that prop became optional too.

## Verification — what was and wasn't run

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/
`check:comment-budget` all run and green (see the PR for the exact
commands). **Not run: a real authenticated `/recepten` route in a browser**
— this dev machine has no Docker/local Supabase (`CLAUDE.md`), so there is
no way to sign in or fetch a real category/recipe row here, the same
standing gap every Phase 3/4 page has hit
(`docs/HANDOFF.md`'s "Nothing below has run for real" section, now also
covering `lib/recipes/queries.ts`). The empty-category-column and drag-
disabled-cursor behaviours are inherited, unit-tested code paths from
`BoardView.tsx` (`design/notes/BoardView.md`) — nothing in this ticket
touched `BoardView.tsx` itself.
