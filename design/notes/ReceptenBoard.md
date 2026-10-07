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
three categories. Not built.

**Closed 2026-08-02**: user confirmed a 4th category was originally intended
but is fine to leave unbuilt — everything on this screen is placeholder
content for now. Removed from `docs/open-questions.md`.

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

## Drag & drop: full parity with Te-Doen (#155)

**#124's decision (disabled, no `position` column) is reversed.** The user
asked for the same drag behaviour Te-Doen already has ("zoals tickets bij
te-doen dat wel kunnen") — full parity, including in-column reordering, not
just the cross-column half #124 had already flagged as technically
reachable. `20260802010000_recipe_position.sql` adds `recipes.position`
(same fractional-positioning scheme as `recipe_categories.position` /
`board_columns.position` / `cards.position`, backfilled per-category by
`created_at` order so nothing visibly reorders the first time this lands),
which is exactly the thing #124's "meaningless index" reasoning said was
missing — with it, a drop's `toIndex` now has a real neighbour set to
persist against, the same as a Te-Doen card's drop.

**#124's rejected alternative (persist only the category change, drop
`toIndex` silently) stays rejected — a real `position` column was built
instead of shipping that shortcut.** A card visually landing at the drop
index and then jumping back to `created_at` order on the next refresh would
have been the exact user-visible glitch that alternative produces; #155
explicitly asked for the real column instead.

**Implementation, mirroring `app/(app)/te-doen/` exactly:**
- `app/(app)/recepten/actions.ts`'s `moveRecipe` is `moveCard`'s structural
  twin — parse, resolve neighbours via `nextPosition`, explicit ownership
  check on the target `recipe_categories` row. The one real difference:
  `moveCard` needs a second lookup (the target column's `board_id`) because
  a column can belong to a *different* board of the same user; a
  `recipe_categories` row has no such parent to mismatch against, so
  verifying the target category's own `user_id` is already the complete
  check — no `column-mismatch`-shaped error code exists for recipes.
- `ReceptenBoard.tsx` gained the same `localCategories`/`pendingMoves`
  (a count)/`moveQueue`/`moveError` machinery as `TeDoenBoard.tsx`'s
  `handleMove`, keyed on `localCategories` directly rather than a nested
  `localBoard.columns` — this page has no separate "board" wrapper object,
  a recipe category IS the column.
- `lib/boards/optimistic.ts`'s `applyCardMove` (was hardcoded to
  `BoardWithColumns`/`CardWithLabels`/the `"cards"` key) is now a thin
  wrapper around a new exported `applyItemMove<TItem, TKey, TColumn>`,
  parameterized over the items-array key name (`"cards"` vs `"recipes"` —
  the one thing that actually varies between the two callers, since a
  recipe category has no further "board" wrapper the way `BoardWithColumns`
  does). `applyCardMove`'s own two-argument call shape is unchanged, so
  `tests/boards-optimistic.test.ts` needed no edits. Chose one shared
  generic implementation over a second copy-pasted `applyRecipeMove`
  because the remove-then-reinsert-clamped-to-siblings algorithm itself is
  identical; only the key name differs, and that's a one-argument
  parameterization, not a fight with the type system.
- `getRecipeCategoriesWithRecipes` (`lib/recipes/queries.ts`) now sorts
  nested recipes by `position` instead of the old `created_at` fallback.
- `createRecipe` gained a `lastRecipePosition` helper (the
  `recipe_categories : recipes :: board_columns : cards` analogue of
  `lastCardPosition`) so a new recipe appends at the end of its category
  instead of getting no position at all. `updateRecipe` assigns a fresh
  end-of-category position when `categoryId` names a *different* category
  than the stored one — a recipe moved via the edit panel (not drag & drop)
  has no drop index to derive a position from, so it lands at the end of its
  new category rather than keeping a `position` value that made sense only
  among its old category's siblings. The comparison against the stored
  `category_id` is load-bearing, not defensive: `RecipePanel` sends
  `categoryId` on *every* save, so re-positioning whenever the field is
  merely present would drop a recipe to the bottom of its column each time
  the user edited its title — silently undoing a drag. Harmless before #155
  (the list was `created_at`-ordered); a visible bug the moment order became
  user-controlled.

**RLS**: no new policies/grants needed. `supabase/tests/rls-recipes.sql`'s
existing two-user isolation assertions (select/update/delete/insert) already
cover every column on `public.recipes`, `position` included — verified, not
extended, when #155 landed.

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

## Import additions (#318)

- Plus button gets a `relative` wrapper and an optional `addMenu` slot (`BoardView.renderAddMenu`) for the "Via link / Handmatig" menu (`AddRecipeMenu.md`).
- Cards render by `import_status`: `done` the normal card, `importing` `CardContentRecipeSkeleton`, `failed` `CardContentRecipeFailed`. Only `done` cards open the detail page. The board polls `router.refresh()` every 2.5 s only while a card is importing and the tab is visible (`lib/recipes/import/polling.ts`); the lazy sweep (`lib/recipes/import/sweep.ts`) runs on each board load.
