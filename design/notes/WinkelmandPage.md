# /winkelmand page (`page.tsx` + `WinkelmandList.tsx`)

- **Code:** `app/(app)/winkelmand/page.tsx` (Server Component, fetch + translations), `WinkelmandList.tsx` (`"use client"`, page-level composition — same non-mapped-component precedent as `ReceptenBoard.tsx`, not added to `design/figma-map.json`), `app/(app)/winkelmand/actions.ts` (#176, extended #179), `lib/shopping/queries.ts` (#176, extended #179).
- **Node IDs, current (#179):** `4051:13049` Desktop/Default, `4051:13040` Mobile/Default, `4052:13700` Desktop/Sort, `4052:13689` Mobile/Sort, `4049:11175` Desktop/EmptyState, `4049:11167` Mobile/EmptyState. **The `4044:10838`/`4044:10830` pair #177 originally fetched no longer exists** (REST `nodes?ids=` returns null, confirmed by #179's own re-fetch) — the designer replaced the whole page frame set; the `4051:*`/`4052:*`/`4049:*` ids above are the current source of truth. State mockups `3779:4112`/`3779:3996` (checked rows + slide-to-delete) are unaffected, still screenshotted-not-fetched per #177's own reasoning.

Built #177. Fetched all nodes live via `get_design_context` (desktop/mobile) and `get_screenshot` (the two state mockups) before writing any UI.

## Composition — no new components

Literal read of the fetched nodes: `PageHeader` (title + actions slots = the "Header" frame exactly), one `Card` per group (`title` = source recipe name / NEVO food group / "Overig", per #179 below), N `CardContentIngredient` rows per group (`divider={index < group.items.length - 1}`, matching the fetched border-b-on-all-but-last pattern), `Button variant="destructive" icon="Trash"` for "Verwijder alles", `Button icon="ArrowUpDown"` + labelless `Dropdown` for "Sorteer" (#179). No new atom/molecule/organism — everything in `WinkelmandList.tsx` composes existing, already-storied pieces, same "full route body, not a self-contained overlay" precedent `RecipeDetailPage.md`'s own "Ladle — no new story" section gives for skipping a new Ladle story here too.

## #179 (2026-08-09) — grouped by recipe/food-group, sort dropdown, real empty state, margin, "Verwijder alles"

Re-fetched every node this ticket touches (see the node-id list above) via `get_figma_data` (geometry) and the REST `nodes?ids=` endpoint (annotations — MCP drops them). Six annotations found and built against, all quoted in the sections below.

### Grouping — one `Card` per source recipe or per food group

Annotation on `I4051:13057;3997:25433` ("Titel", the Card's title text): *"Added card title. Shows name of recepi that ingredients got added from. When ingredient was added individually name = Other"*. `WinkelmandList.tsx`'s `buildGroups()` groups `localItems` on `recipe_id` (default, "Recept") or on `reference_ingredient_id`'s resolved `category_nl`/`category_en` ("Voedingsgroep"); either way, items with no real group identity (`recipe_id === null`, or no resolvable category) fall into one shared group keyed `__other__`, labelled via `shopping.page.otherGroupLabel` ("Overig"/"Other") — the annotation's own "individually added = Other" reading, generalised to the food-group axis too since the ticket didn't distinguish. Groups otherwise keep first-seen order, which is `items`' own `position` order (`getShoppingListItems`, unchanged) — no separate sort pass needed; the `__other__` group is always pushed last regardless of its own first item's position, a deliberate, documented reading of "items with recipe_id = null go in a final group" taking precedence over the general position rule for that one group only.

`Settings` (the Pas-aan gear button `Card.tsx` can render in its title row) is `visible: false` on every fetched Winkelmand `Card` instance — not rendered here, matching the fetched node exactly.

**`sendRecipeToShoppingList` already set `recipe_id`** (`app/(app)/winkelmand/actions.ts`, #178) — verified by reading the code before assuming the ticket's premise, not copied from it. No fix was needed there.

**`reference_ingredient_id` did need building**, both the column and the send-time resolution:
- Migration `20260809000001_shopping_list_items_reference_ingredient.sql` adds `public.shopping_list_items.reference_ingredient_id uuid references reference.ingredients (id) on delete set null`, nullable (a manually-typed item, or any ingredient without a library match, resolves to nothing — same reasoning `recipe_id` already established, not repeated as a NOT NULL column, which would break `supabase/tests/rls-shopping_list_items.sql`'s no-reference fixtures).
- The chain (`recipe_ingredients.ingredient_id` → `public.ingredients.reference_id` → `reference.ingredients.id`) was already resolved once per recipe ingredient by `lib/recipes/queries.ts`'s `nutritionInputsForIngredients` (for the nutrition-per-person feature, ADR-0013) — rather than a second lookup, that function now also exposes `referenceIngredientId` on its per-row result, threaded onto `RecipeIngredientWithNutrition` and carried through `lib/shopping/send-to-list.ts`'s merge (first-seen wins, same rule as the merged line's own `name`) into `shopping_list_items.reference_ingredient_id` at insert time.
- `lib/database.types.ts` updated by hand (no Docker on this machine, `supabase gen types` unavailable) — Row/Insert/Update plus a `Relationships` entry, following `ingredients.reference_id`'s own precedent of keeping a cross-schema FK relationship in this hand-written file even though a real generator run would drop it (data-layer guide's own noted `reference` schema-exposure quirk).

### Read side — recipe title + food-group name, two batched queries, never per-row

`getShoppingListItems()` (`lib/shopping/queries.ts`) now also resolves, for the whole list in one pass: the source recipe's `title` (`titlesByRecipeId`, one `.in("id", …)` query against `public.recipes`) and the linked `reference.ingredients` row's `category_nl`/`category_en` (`categoriesByReferenceIngredientId`, one `.in("id", …)` query against the `reference` schema). Two extra queries total, not one per group and not one per row — same batched-lookup shape `lib/recipes/queries.ts`'s own `nutritionInputsForIngredients` already established for exactly this "resolve a nullable FK across a set of rows" problem.

**Deliberately not a single embedded `.select("*, recipes(title)")`.** Considered and rejected: `shopping_list_items.recipe_id` has no unique constraint, so postgrest-js's generated result type resolves a forward FK embed to an array (`recipes: RecipeRow[]`) whenever the `Relationships` entry's `isOneToOne` is `false` — which is what a real `supabase gen types` run would also emit for a plain many-to-one column, per the library's own `ProcessEmbeddedResourceResult` logic (checked directly in `node_modules/@supabase/postgrest-js`, not assumed). Without Docker/a real generator run on this dev machine to verify the actual emitted shape, betting the read path's compile-time types on that inference was rejected as unnecessary risk for zero gain over the batched-query shape this codebase already uses everywhere else for the same problem. `reference.ingredients` was never a candidate for embedding at all — it's a separate Postgres schema, which PostgREST can't embed into a same-schema `.select()` regardless.

### Sort button + dropdown — exact `TeDoenHeader.tsx` pattern

Annotation on `4052:13706` (the Sorteer Button): *"On click show dropdown exactely like in kanban page"*. Reused, not reinvented: the same `relative` wrapper + `useCloseOnOutsidePointerDown` (pointerdown-outside closes, no Escape handling — Figma only specifies click-outside) + `absolute top-full right-0 z-[999] mt-2 w-[209px]` panel positioning + labelless `Dropdown` with `shadow-sm` that `TeDoenHeader.tsx`'s own sort menu already implements, right down to the per-option `variant={option === selected ? "filled" : "white"}` + `aria-pressed` styling. Annotation on the panel slot `I4052:13973;3705:4471`: *"See #DropdownActive component for stack margin token. z-index: 999. Click outside to disappear"* — the `mt-2`/`z-[999]` pair above is that "stack margin token"/z-index read literally off the fetched panel, same values `TeDoenHeader.tsx` already uses for its own two menus.

Two options, both from the fetched node: `Recept` (`Icon/FolderClosed`, the default — annotation *"Sorteert op recept waar de ingredient vandaan was toegevoegd (standaard)"*) and `Voedingsgroep` (`Icon/Broccoli`). **View-only, component-local `useState`, no URL param** — unlike `TeDoenHeader.tsx`'s sort, which persists via `?sort=` because Te-Doen's board is itself URL-addressed and the ticket asked for a shareable/bookmarkable view. Nothing in #179's ticket text or the fetched node asks for the Winkelmand sort choice to survive navigation/reload, so it resets to "Recept" on next page load — a deliberate, smaller-footprint deviation from the reused pattern's own persistence, not an oversight.

**Reusing the pattern surfaced a real bug the reused code never hit before**: the panel rendered behind the ingredient rows below it despite its own `z-[999]`, because those rows (unlike Te-Doen's board columns) are themselves `position: relative`. Root-caused and fixed at `PageHeader.tsx` (`z-10` on the sticky header itself), not worked around here — full CSS stacking-context diagnosis in that component's own `design/notes/PageHeader.md` #179 entry.

**Mobile node text mismatch, not built as literal.** Both fetched mobile frames (`4051:13040` Default, `4052:13689` Sort) render the Sort button's `Text` property as `"Voeg toe aan mand"` while using `Icon/Arrow-up-down` — the same icon, same component structure, same position as desktop's own Sort button, which correctly reads `"Sorteer"` in every fetched frame. Read as a copy-paste text-override artifact (the button was very likely duplicated from `RecipeDetailPage.tsx`'s "Voeg toe aan mand" button and its `Text` override never updated for this frame) rather than an intentional mobile-only label, since the icon and behaviour annotation both point at "sort," never "add." Built as `"Sorteer"` at every breakpoint, consistent with desktop and with the dropdown's own `Recept`/`Voedingsgroep` semantics — flagged here per `CLAUDE.md` rather than silently reconciled.

### Empty state — real design, resolves `winkelmand-empty-state-undesigned`

Nodes `4049:11175`/`4049:11167` draw a `Card` (no `title`/`settings` — the "Stap + Card" frame here has no title row at all, matching an untitled `Card` call) containing centred text `"Winkelmand is leeg"` and a `Button` `"Ga naar recepten"` with a **trailing** `Icon/ArrowRight` (new icon, `design/notes/Icon.md`'s own #179 entry), linking to `/recepten` via `useRouter().push`. **Verified, not assumed: the header on both empty-state frames carries no action buttons** (`Knoppen` frame present but empty in both fetches) — `WinkelmandList.tsx` renders `PageHeader`'s `actions` slot as `undefined` whenever the list is empty, hiding both the new Sort button and "Verwijder alles" together, not just the one the old placeholder already had nothing to compare against.

**Button width is breakpoint-specific, read directly off the fetched geometry, not guessed as "full-width" everywhere.** Desktop's Button carries no `alignSelf` override inside its centred, non-stretching parent (`EmptyText`, `alignItems: center`) — it hugs at its own content width, centred. Mobile's identical Button explicitly sets `alignSelf: stretch`, filling the row. `className="w-full md:w-fit"` on the Button reproduces exactly that split (Button's own base class is `inline-flex`/hugs by default, so only the mobile override needed stating).

The former placeholder (`shopping.page.emptyStateText`, plain `<p>`, no card) is removed from both message catalogs, replaced by `shopping.page.emptyStateTitle`/`emptyStateCta`. `docs/open-questions.md#winkelmand-empty-state-undesigned` is resolved and removed (see that file's own diff).

### Right margin — scoped to this page's own content, not `main`

Ticket: *"bij de card waar ingrediënten in staan moet margin rechts hebben tussen rand van scherm. Nu geen margin aanwezig."* Root cause, confirmed by reading `AppShellNav.tsx` directly: `<main>` carries `pl-4 md:pl-32` and no right padding at all; `PageHeader.tsx` compensates with its own `pr-4 md:pr-32`, so the header lines up but every sibling below it (the Card list, and the empty-state Card) bleeds to the screen edge. **Not fixed on `main`** — the Te-Doen/Recepten kanban carousel deliberately bleeds off the right edge there, and adding `main`-level right padding would clip it. Fixed by giving `WinkelmandList.tsx`'s own content wrapper (both the empty-state branch and the grouped-Cards branch) the identical `pr-4 md:pr-32` `PageHeader` already uses — confirmed against the fetched desktop (`Main` padding `80px 128px`, i.e. symmetric 128px left/right, matching `md:pl-32`/`md:pr-32` exactly) and mobile (`Main` padding `16px 16px 80px`, i.e. symmetric 16px left/right, matching `pl-4`/`pr-4`) nodes rather than assumed to mirror the left value.

### "Verwijder alles" — text updated, key unchanged

Annotation on `4053:14285`: *"Updated text"* — the destructive header button's Figma `Text` property changed from "Alles verwijderen" to "Verwijder alles". `messages/nl.json`'s `shopping.page.clearAllLabel` value updated to match (both catalogs touched, ADR-0007, though English's "Delete all" already reads correctly in the new word order and needed no change). The key itself (`clearAllLabel`) is unchanged — still the same button, same semantics, just a copy fix.

**Superseded 2026-08-10 by direct user instruction: the button now reads "Leeg mand" / "Empty basket".** `clearAllLabel` keeps its name for the third time running — same button, same single-click destructive semantics, copy only. English follows `emptyStateTitle`'s existing "Shopping basket" wording rather than a literal "Empty bin". **This deviates from Figma**: node `4053:14274`/`4053:14285` still draws `Text: "Verwijder alles"`, so code and design file now disagree on this one string until the designer updates it. Recorded rather than silently reconciled, per `CLAUDE.md` — the copy came from the user, not from a fetched node, and the surrounding sections above are still the authority on everything else about this button.

### Section grouping and manual add — `section` still unread, manual add still unbuilt

`shopping_list_items.section` (#175) is still fetched-and-passed-through-unused by `getShoppingListItems()` — #179 built recipe/food-group grouping, which is a different axis from the supermarket-`section` column `docs/open-questions.md#winkelmand-no-section-grouping` tracks (narrowed, not resolved, by this ticket — see that file). `addShoppingListItem` (#176) still has no UI call site; `docs/open-questions.md#winkelmand-no-manual-add-entry-point` is unaffected by this ticket.

### Verification — #166 fixes confirmed live, one real bug found and fixed

Both #166-era bug reports were checked in a real browser (Playwright against `pnpm dev`, `/winkelmand`), not re-assumed fixed from the git history alone:
- **Corner radius / divider**: confirmed already correct — `CardContentIngredient.tsx` renders the divider as an unrounded sibling `<div>`, matching `RecipeDetailPage.tsx`'s own fix. No change needed.
- **Hover disturbing the desktop slide effect**: confirmed still broken, root-caused, and fixed. `CardContentIngredient.tsx`'s `handlePointerMove` updated `dragPx` on every native `pointermove` over the row, unconditionally. On touch, `pointermove` only fires during an active drag (a finger is down); on desktop, a mouse fires `pointermove` continuously while merely hovering, with no button pressed. Because `dragStartX.current` still held its last value (`0`, or a stale value from a previous real drag), any mouse movement across the row computed a large, arbitrary `dragPx` from wherever the cursor happened to be on screen — visibly sliding/shifting the row on hover alone, exactly the reported symptom (and the mechanism behind the ticket's own "padding swap" candidate: `offset < 0 ? "bg-surface-raised pr-4" : "pr-3"` is a symptom of this same stray `dragPx`, not a separate bug). Fixed with an explicit `dragging` boolean, set in `handlePointerDown`/cleared in `handlePointerEnd`, gating `handlePointerMove`'s body — pointer capture already scopes real drags to this element, so the gate only ever suppresses the no-button-down hover case. See `design/notes/CardContentIngredient.md`'s own #179 entry for the fix itself.

## Server/client split

Identical shape to `ReceptenBoard.md`: `page.tsx` fetches `ShoppingListItemWithGroupInfo[]` (`getShoppingListItems()`, #176, extended #179) and translated strings, and hands only that plain data to `WinkelmandList.tsx`. Nothing here needed a function-prop boundary the way `ReceptenBoard.tsx`'s `renderItem` did — this split follows the same house-style precedent (thin Server Component fetch, "use client" child owns interaction), not a technical necessity of this particular page. #179 also dropped `page.tsx`'s `clearAllLabel`/`emptyStateText` props: `WinkelmandList.tsx` already called `useTranslations` client-side for other `shopping.page.*` keys (errors, per-row delete label), so the new grouping/sort/empty-state strings joined that same client-side lookup rather than growing the server→client prop list further.

## Quantity Tag — short unit labels + ASCII fractions, not the ingredient-card long form

`RecipeDetailPage.tsx`'s own ingredient-card Tag uses `recipes.units` (long labels: "Cup", "Tablespoon") via `formatQuantityFraction`. The Winkelmand node draws the opposite: fetched Tag text reads "1 cup", "1/4 cup", "2 tbs", "1 tsp", "1/2 cup", "2 scoops" — abbreviated labels and ASCII fraction notation, i.e. the same `recipes.unitsShort` + `formatQuantityFraction` pair `RecipeDetailPage.tsx`'s per-*step* Tag uses, not its per-ingredient-card Tag. Built to match this ticket's own fetched node directly (`CLAUDE.md`: fetch, don't guess from another page's precedent) rather than copying the other page's convention.

`quantityLabel()` (`WinkelmandList.tsx`) handles the schema's two independently-nullable columns `shopping_list_items.quantity`/`unit` (#175 — unlike `recipe_ingredients.unit`, which is `not null`):
- `quantity === null` → `undefined` (Tag omitted — the prop is optional, per the ticket's own instruction; no Figma-drawn "quantity-less" row exists to verify a rendered fallback against).
- `quantity` set, `unit` set → `formatQuantityFraction(quantity, unit, tUnitsShort(unit))`, matching the fetched fraction+short-label Tags above.
- `quantity` set, `unit === null` (a manually-typed item like "melk 2", once a manual-add UI exists — see `docs/open-questions.md#winkelmand-no-manual-add-entry-point`) → `formatQuantity(quantity, null)`, `units.ts`'s own plain decimal formatter — `formatQuantityFraction` requires a non-null `UnitCode` (its fraction-vs-decimal choice is `magnitudeOf(unit)`-driven, and there is no magnitude without a unit), so a unit-less quantity can't use it. Plain decimal is the least-invented fallback: no unit to derive a fraction-appropriate magnitude from, so no fraction ladder is attempted.

## Row interactions — optimistic, no move queue

`WinkelmandList.tsx`'s `runAction()` is a smaller sibling of `ReceptenBoard.tsx`'s `handleMove`: snapshot-before, optimistic update, call the server action, revert + surface `shopping.errors.*` on failure, `pendingActions` (a ref *count*, same reasoning as `ReceptenBoard.tsx`'s `pendingMoves`) guards the `items` prop → `localItems` resync against a background revalidation clobbering an in-flight update. **Deliberately no `moveQueue`-style sequential chain**: `ReceptenBoard.tsx` serializes `moveRecipe` calls because each one computes `targetIndex` against sibling `position` values that a second, still-in-flight move could invalidate. Every action here (`toggleShoppingListItem`/`deleteShoppingListItem`/`clearShoppingList`) targets a row (or all rows) by `id` alone with no neighbour-relative math, so two concurrent calls can never race each other's computation — firing them independently is correct, not a shortcut.

`swipeAction="delete"` (renamed from `swipeToDelete: true` in #179 part 2, when the prop generalised to also cover `State=Cart` — see `design/notes/CardContentIngredient.md`)/`onDelete`/`deleteLabel` are passed on every row — #177 is this gesture's first real UI consumer (built in #160, exercised only by a Ladle story until now).

## `deleteLabel` — per-row, not the generic ingredient string

`components.cardContentIngredient.deleteLabel` ("Ingrediënt verwijderen"/"Delete ingredient") already exists and is generic — it doesn't name which row. Judgment call: this page uses a new interpolated key instead, `shopping.page.deleteItemLabel` ("Verwijder {name}"/"Delete {name}"), so a screen-reader user tabbing to a row's (now keyboard-reachable, #177's `CardContentIngredient.md` fix) delete button hears which item it deletes — the same reasoning `CardContentIngredient.md` already gives for the row's own `Checkbox` using the ingredient's `name` as its accessible name, extended to the delete button now that it has a real keyboard path. Not a Figma-sourced string (the fetched node has no per-row delete label to read at all, since Delete is a swipe-revealed state); both catalogs carry the new key, ADR-0007.

## "Verwijder alles" — literal single-click read, no invented confirm

See `docs/open-questions.md#winkelmand-clear-all-no-confirmation`. Built exactly as the fetched header shows (one destructive `Button`, no confirm state) rather than importing `RecipeDetailPage.tsx`'s two-step confirm pattern uninvited — the ticket's own instruction was to flag this gap, not resolve it with an invented pattern. Text updated by #179, see that ticket's own section above.

## Manual add — still not built, flagged

`addShoppingListItem` (#176) still has no UI call site as of #179 — see `docs/open-questions.md#winkelmand-no-manual-add-entry-point`. Empty state and section/food-group grouping are now built (#179, see that ticket's own sections above) — this is the one remaining flagged gap from #177's original list.

## Keyboard-accessible swipe-to-delete — assessed, fixed

`design/notes/CardContentIngredient.md`'s #160 entry flagged the swipe reveal's missing keyboard path and named this ticket as "the moment" to address it. Assessed and fixed at the molecule (not worked around at this page) — full reasoning, the fix itself, and its one accepted trade-off (within-row tab order) are recorded in `CardContentIngredient.md`'s own "#177" entry, not duplicated here.

## `nav.shopping` — new key, mirrors the Sidebar's existing label

`components.sidebar.items.shopping` ("Winkelmand"/"Shopping basket") already existed (#88) for the Sidebar row; this page's own `<h1>` needed its own translation key rather than importing a `components.sidebar.*` string into a page title (same separation `nav.recipes` already keeps from `components.sidebar.items.recipes`, both independently declared with the identical value) — `nav.shopping` added, same value both places by construction, not by a shared reference.

## Verification

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` run — see the PR for exact numbers. `pnpm test:visual` not run: no story was added or changed, and neither `CardContentIngredient.tsx`'s nor `PageHeader.tsx`'s #179 fixes touch static-render CSS/pixels (event-handler logic and a `z-10` utility respectively — see each file's own note).

**#179 broke the standing "no Docker, no live browser" gap.** A throwaway test user was created via the Supabase Admin API (service_role, run as a local Node script — never committed, never shipped in app code, same "admin task, not a runtime path" category as `scripts/import-nevo.ts`'s own service_role use) against the real hosted project, seeded with seven `shopping_list_items` rows (five under one `recipes` row, two with `recipe_id null`) via `execute_sql`, then driven through a real login and `/winkelmand` with Playwright — desktop and mobile viewports, both screenshotted and inspected. Both test rows and the test user were deleted afterward; nothing was left behind. **Not exercised**: the new `reference_ingredient_id` write path (`sendRecipeToShoppingList`'s insert) and Voedingsgroep grouping with a real resolved category — the migration adding that column hadn't reached the hosted project yet (ADR-0012: only the user-run `deploy.yml` workflow applies it, and that ticket was explicitly forbidden from applying it by hand), so a live insert against that column wasn't possible from that session. **The migration was applied by hand on 2026-08-09 with the user's explicit approval** after they reported the Winkelmand staying empty — every insert on both add paths had been failing with `PGRST204`; full account in `RecipeDetailPage.md`'s own "Resolved 2026-08-09" entry. The write path and Voedingsgroep grouping with a real resolved category are now unblocked but **still not exercised live** — nobody has re-run the Playwright pass since. `getShoppingListItems()`'s defensive `id != null` filter (not just `!== null`) was added specifically because this un-migrated hosted state made `reference_ingredient_id` come back `undefined` rather than `null`, and the original `!== null` check let an `"undefined"` string reach a `uuid` column filter — caught live, not by reasoning alone.

Confirmed live: grouping (by-recipe and the `Overig` fallback for `recipe_id === null` rows), the Sort dropdown's open/close/outside-click/keyboard-selection, the corner-radius/divider fix (already correct, no change needed), the right-margin fix on both breakpoints, the empty state (both breakpoints, including its `/recepten` navigation), and the hover-vs-drag fix on `CardContentIngredient` (verified both ways: a script-dispatched hover-only `pointermove` sequence, no `pointerdown`, produces zero transform change; a real Playwright mouse drag still opens the row to exactly `REVEAL_PX`). Also found and fixed live, not anticipated going in: the Sort dropdown's `z-999` panel rendered *behind* the ingredient rows below it (`PageHeader.tsx`'s own `#179` entry has the full stacking-context diagnosis).

## #182 (2026-08-10) — desktop grouping fix, icon-only mobile Sort, per-breakpoint dropdown anchor

Nodes re-checked against the #179 fetch above (`4051:13049` Desktop/Default, `4052:13700` Desktop/Sort, `4051:13040` Mobile/Default, `4052:13689` Mobile/Sort) — no new fetch needed, the geometry this ticket turns on was already captured live and re-verified in a real browser rather than re-pulled from Figma a second time.

### Desktop misalignment — root cause was a Fragment, not a spacing value

`PageHeader`'s `<header>` is itself `flex justify-between` between the title block and `actions` (see `PageHeader.md`). The old code passed the Sort wrapper and "Verwijder alles" as two `<>...</>` siblings into `actions` — React renders a Fragment's children as flat siblings of the parent, so `<header>` saw **three** flex children (title, Sort, Verwijder-alles) and its own `space-between` spread Sort away from Verwijder-alles instead of grouping them, contradicting Figma's single `Knoppen` frame (`row`, `gap: 8px` mobile / `20px` desktop). Fixed by wrapping both buttons in one `<div className="flex items-center gap-2 md:gap-5">` — now `actions` is a single flex child, and the wrapper's own `gap` reproduces `Knoppen`'s spacing at both breakpoints. Confirmed live at 1440px: the Dropdown panel's right edge (measured `1133.05px`) exactly matches the Sort button's own right edge (`1133.05px`), matching the Desktop/Sort node's `absoluteBoundingBox` read pixel-for-pixel.

### Mobile Sort button — icon-only, `aria-label` carries the name at every breakpoint

Fetched Mobile/Sort (`4052:13689`) draws the Sort button with `"With text": false`, `"Leading icon": true` — icon-only. Built as `<span className="hidden md:inline">{t("sortLabel")}</span>` inside the `Button`, with a permanent `aria-label={t("sortLabel")}` on the `Button` itself (not swapped per breakpoint), so the accessible name doesn't depend on which text node happens to be visible. `shopping.page.sortLabel` (already existed, both catalogs, used for the desktop button text since #179) covers the aria-label too — no new i18n key needed. "Verwijder alles" (`4053:14274`) keeps `"With text": true` on mobile — not touched.

### Dropdown anchor — left on mobile, right on desktop, one positioning context at every breakpoint

Two things were pixel-verified, not assumed: (1) on desktop, the Dropdown's own `absoluteBoundingBox` right edge matches the **Sort button's** right edge, not the button group's — desktop must anchor `right-0` off the Sort wrapper specifically; (2) Figma draws **no** open-dropdown state on mobile at all (`4052:13689` has no Dropdown child) — the mobile anchor is undesigned and this ticket's own call (see `docs/open-questions.md#winkelmand-mobile-sort-dropdown-anchor-undesigned`).

An earlier version of this fix flipped which ancestor was the positioning context per breakpoint (`relative md:static` on the group, `static md:relative` on the Sort wrapper) so the panel right-aligned to the *group* on mobile — chosen because a `right-0` panel anchored to the narrow icon-only Sort button alone would run off the left edge of the screen (reproduced at 390px: panel left edge landed at `x=-2`). **Superseded by user decision**: right-aligning to the group put the open panel on the far right of the header while the tapped button sits on the left, breaking the panel's visual attachment to the control that opened it. The Sort wrapper now stays `relative` at every breakpoint (no `static`/`relative` flip), and only the panel's horizontal anchor switches: `left-0` below `md`, `md:left-auto md:right-0` from `md` up — `left-0 z-[999] mt-2 w-[209px] md:left-auto md:right-0`.

**Geometry, measured live (Playwright, `pnpm dev`, the seeded 9-item preview route), panel vs. viewport:**

| viewport | Sort button left/right | panel left/right (209px wide) | fits? |
| --- | --- | --- | --- |
| 320px | 129.96 / 169.96 | 129.96 / 338.96 | **no** — panel right edge overflows by ~19px |
| 375px | 152.05 / 192.05 | 152.05 / 361.05 | yes |
| 390px | 167.05 / 207.05 | 167.05 / 376.05 | yes |
| 430px | 207.05 / 247.05 | 207.05 / 416.05 | yes |

**The 320px overflow is not caused by the anchor choice.** With the dropdown fully closed, `document.body.scrollWidth` is already `339px` at a `320px` viewport — the header's own content (title `"Winkelmand"` + icon-only Sort + `"Verwijder alles"`, no wrap, default flex-shrink blocked by each button's min-content width) doesn't fit in 320px regardless of any dropdown. Binary-searched live: the row needs `~339px` minimum, so anything narrower than that overflows horizontally with or without the panel open. The panel's own right edge (`338.96px`) lands almost exactly on top of the already-overflowing "Verwijder alles" button's right edge (`336.91px` at the same width) — the panel adds about 2px beyond a pre-existing overflow, not a new one. Confirmed this predates #182 and would have been *worse* on the old code: the pre-#182 mobile Sort button rendered full text ("Sorteer", not icon-only), which is wider than the icon-only button this ticket ships, so #182 shrinks the header's minimum content width rather than growing it. Flagged, not fixed here — out of this ticket's scope (button-row width, not dropdown alignment) — see `docs/open-questions.md#winkelmand-mobile-header-content-overflows-320px`.

## TICKET #205 (2026-08-12): page-padding token

`WinkelmandList.tsx`'s empty-state wrapper and its items-list wrapper:
both `pr-4 md:pr-32`→`pr-page-right-equal`. No node lookup needed, per the
ticket's own page-padding rule.

## #219

Measured against `Pages/Winkelmand/Breakpoints` (`3778:5816`) →
`Mobile/Default` (`4051:13040`), `Desktop/Default` (`4051:13049`),
`Mobile/EmptyState` (`4049:11167`), `Desktop/EmptyState` (`4049:11175`).

### Converted

`WinkelmandList.tsx:233` — the Sort/Verwijder-alles actions row, `gap-2
md:gap-5`→`gap-inline-sm md:gap-inline-xl`, measured off the "Knoppen"
frame:

| old utility | new utility | node-id | `boundVariables` key | variable |
| --- | --- | --- | --- | --- |
| `gap-2` | `gap-inline-sm` | `4051:13045` (mobile Knoppen) | `itemSpacing` | `spacing/inline/gap-sm` (8px) |
| `md:gap-5` | `md:gap-inline-xl` | `4051:13054` (desktop Knoppen) | `itemSpacing` | `spacing/inline/gap-xl` (20px) |

`inline-sm`/`inline-xl` don't self-switch (unlike the three bold `page/*`
tokens), so the `md:` prefix stays — dropping it would apply `inline-xl`
at every breakpoint instead of only ≥768px.

### Flagged

`WinkelmandList.tsx:295` — the empty-state Card's title+CTA wrapper
(`gap-2 py-4`). Measured the fetched EmptyState `Card` instance
(`4049:11174` mobile / `4050:11597` desktop): its actual children are a
"Step" number-badge instance and a "Type" slot (padding bound
`spacing/component/padding-sm` on all sides) holding an "EmptyText" text
frame (own `paddingTop`/`paddingBottom` bound `spacing/component/
padding-lg` = 16px) and a "Button" instance, with `itemSpacing: 0` between
them and **no `boundVariables` entry at all** for that `itemSpacing`. No
node in this subtree binds a gap or a padding around a title+CTA *group*
the way the code's wrapper does — the 16px that exists in Figma belongs
to the text node's own padding, a different box than the code's outer
`py-4`. Converting either number would be matching a coincidence, not a
measurement — stays raw. **Superseded by #222 pt.5 below — this call
compared the wrapper against the wrong box; both the padding and the gap
turned out to be real, boundVariables-backed measurements once read on
the right node.**

`WinkelmandList.tsx:308` — the non-empty items-list wrapper (`gap-6`).
Measured the fetched Default frames' "Ingredients" wrapper (`4051:13534`
mobile / `4051:13056` desktop, parent of the per-group `Card` instances):
`itemSpacing: 24` but **no `boundVariables` entry** — an unbound/detached
value in Figma itself. 24px coincides with both `spacing/page/stack` and
`spacing/stack/stack-xl`; with no binding to disambiguate, picking either
would be exactly the value-matching this ticket exists to forbid. Stays
raw.

## #222 (2026-08-16) — mobile "Leeg mand"→"Leeg", "+ Item" header button, EmptyState card margin

Three of #222's seven points. Node ids all re-verified live via the
`figma-console` bridge (`figma_execute`, `boundVariables` read through
`figma.variables.getVariableByIdAsync()`), not re-used from memory.

### pt.1 — "Leeg mand" is desktop-only, "Leeg" on mobile

Fetched `4053:14285` (desktop): `Text#3632:5` = `"Leeg mand"`. Fetched
`4053:14274` (mobile): `Text#3632:5` = `"Leeg "` (trailing space in Figma,
trimmed in code, per the ticket's own instruction). Both `Style: Destructive`.
New key `shopping.page.clearAllLabelShort` (nl `"Leeg"`, en `"Empty"` —
the first word of the existing `clearAllLabel` value, same "short variant"
relationship `recipes.unitsShort` already has to `recipes.units`).
`clearAllLabel` itself is unchanged (still the desktop text, "Leeg mand"/
"Empty basket" — #179's own user-instructed deviation from Figma's stale
"Verwijder alles"/"Alles verwijderen " text stays in force here too).

Built as two `<span>`s inside the Button (`md:hidden` / `hidden md:inline`),
same two-span shape the Sort button already established for its own
icon-only-mobile case (#182) — no bare `hidden` on the `Button` root itself
(the #263 trap: `Button`'s own `cva` base is `inline-flex`, which loses to a
bare `hidden` in the compiled stylesheet's cascade order; `md:` variants
land later and do win). Since a text span is always visible at every
breakpoint here (unlike Sort, which is icon-only below `md`), no separate
`aria-label` was needed — the visible span already carries the accessible
name.

### pt.4 — "+ Item" button opens the existing `IngredientSearchPanel`

Fetched mobile `Knoppen` (`4051:13045`, `itemSpacing` bound
`spacing/inline/gap-sm`) and desktop `Knoppen` (`4051:13054`, bound
`spacing/inline/gap-xl`) — both list their children in this order: Plus →
Sort → Destructive. Plus button: mobile `4109:15948` (`Style: Filled`,
`With text#3674:3: false`, 40×40, icon-only) / desktop `4052:13677`
(`Style: Filled`, `With text: true`, `Text: "Item"`, `Icon#3632:0` instance
key `3629:149` = `Icon/Plus`, resolved by name, not guessed from the icon
slot's visual). Built leading (before Sort), `variant="filled"` (Button's
own default, matching Figma's `Style: Filled`), same icon-only-mobile /
labelled-desktop span pattern as Sort and the Destructive button above, with
a permanent `aria-label` (not swapped per breakpoint — same reasoning #182
already gives for Sort's own aria-label).

New key `shopping.page.addItemLabel` — `"Item"` in both catalogs (an
English loanword already standard in this codebase's Dutch UI; not a
translation gap, same as e.g. a bare `"OK"` would be).

**No new panel built.** The ticket's own "ingredientList" screen is
`components/organisms/IngredientSearchPanel.tsx` (Figma "Add recipi/
ingredientList/Mobile", `3957:10309`/panel `3957:10337`) — already built for
#131/RecipePanel.tsx, reused here exactly as `RecipePanel.tsx` itself
reuses it (`open`/`onClose`/`onSearch`/`onCreateOwnIngredient`/`onSave`,
default `level={1}` since Winkelmand isn't nested inside another panel).

- `onSearch`/`onCreateOwnIngredient`: imported straight from
  `app/(app)/recepten/actions.ts` (`searchIngredients`,
  `createOwnIngredient`) into `WinkelmandList.tsx` — no re-export file.
  Precedent checked both directions before choosing this: `ReceptenBoard.tsx`
  ("use client") already imports its own folder's server actions directly
  and passes them as props into `RecipePanel.tsx`; `RecipeDetailPage.tsx`
  (recepten) already imports `app/(app)/winkelmand/actions.ts`'s
  `addIngredientToShoppingList`/`sendRecipeToShoppingList` the *other*
  direction. A Server Action is a global RPC reference, not folder-scoped —
  a re-export shim in `winkelmand/actions.ts` would have added an indirection
  with no behavioural difference, so skipped (the ticket left this as a
  judgment call, "as netter" — the existing precedent already answers it).
- `onSave`: `handleAddIngredients` calls the existing `addShoppingListItem`
  (`app/(app)/winkelmand/actions.ts`, unchanged) once per returned
  `IngredientRow`, **sequentially awaited**, not `Promise.all`.
  `addShoppingListItem` computes its own `position` by reading the current
  last row server-side on each call; firing several in parallel risks two
  calls reading the same "last position" and colliding. Sequential-await is
  not an invented safeguard — it's the same shape
  `IngredientSearchPanel.tsx`'s own `handleSave` already uses for its
  `onCreateOwnIngredient` calls, for the identical reason. No new action was
  written.
- No optimistic `localItems` mutation on add — unlike toggle/delete/clear,
  there's no cheap client-side row to synthesize (recipe/category grouping
  is resolved server-side by `getShoppingListItems`), so the new row simply
  appears once `addShoppingListItem`'s `revalidatePath("/winkelmand")`
  refreshes the `items` prop. A real failure sets `actionError` via the same
  `shopping.errors.*` catalog every other action here uses — no invented
  success indicator. This is a deliberate contrast with
  `AnimatedAddToBasketButton` (see `RecipeDetailPage.md`), which plays its
  "Toegevoegd" animation unconditionally; that gap is accepted and
  documented there, but not repeated here since this ticket explicitly
  named it as a precedent to avoid.
- **Tag omission after adding is expected, not a bug.** The ticket calls
  this out directly: a freshly added ingredient has `quantity: null`
  (`addShoppingListItemSchema` defaults `quantity`/`unit`/`section` to
  `null`), so `quantityLabel()` returns `undefined` and
  `CardContentIngredient` renders no Tag — the same path any manually-typed,
  quantity-less row already takes (`design/notes/WinkelmandPage.md`'s own
  Quantity Tag section above). Nothing to fix.

**EmptyState header actions — corrects #179.** Re-fetching the EmptyState
frames' own `Knoppen` sub-frame (not the Card content — a different part of
the same page) found `4050:11567` (mobile, inside `4049:11167`) and
`4050:11581` (desktop, inside `4049:11175`) each hold **one** child:
`Button/Default`, `Style: Destructive`, `Text: "Alles verwijderen "` (a
third, independently-stale copy of the same button — `4053:14274`/
`4053:14285` already carry a *different* stale string, "Verwijder alles",
per #179's own note two sections up; neither matches the current
user-instructed "Leeg mand"/"Leeg" copy). #179 recorded this frame as
carrying **no** buttons at all ("`Knoppen` frame present but empty in both
fetches") — that was true of an earlier state of the file; it no longer is.
Built to match what's fetched now: `PageHeader`'s `actions` slot renders the
same `clearAllButton` (the pt.1 two-span Destructive button, current copy,
not the stale Figma string — consistent with #179's own established
"user-instructed copy wins over a stale node" call) whether the list is
empty or not; only the Plus/Sort pair is conditional on `!isEmpty`, since
the EmptyState `Knoppen` frame draws exactly one child, not three. Clicking
Clear-all on an empty list is a harmless no-op (`clearShoppingList()` simply
matches zero rows) — not a functional concern, just an odd-looking but
Figma-drawn affordance, recorded here rather than silently removed.

### pt.5 — EmptyState Card margin under "Ga naar recepten"

Re-measured `4049:11174` (mobile) and `4050:11597` (desktop) live, drilling
into `"Stap + Card"` → `"Type"` (the SLOT `Card.tsx` already renders as its
own `p-component-sm` content wrapper):

| node | property | value | `boundVariables` |
| --- | --- | --- | --- |
| `Type` SLOT (both breakpoints) | padding, all sides | 8px | `paddingLeft/Top/Right/Bottom` → `spacing/component/padding-sm` |
| `Type` SLOT (both breakpoints) | `itemSpacing` | 0 | *(no entry — 0 needs none)* |
| `EmptyText` (both breakpoints) | `paddingTop`/`paddingBottom` | 16px | → `spacing/component/padding-lg` |
| `EmptyText` (both breakpoints) | `paddingLeft`/`paddingRight` | 0 | *(unbound — 0)* |
| `EmptyText` text node | `textAlignHorizontal` | `CENTER` | — |
| `Button` (mobile, `4049:11508`) | `layoutAlign` | `STRETCH` | already built (`w-full`) |
| `Button` (desktop, `4050:11596`) | `layoutAlign` | `INHERIT` (hugs) | already built (`md:w-fit`) |

8 (slot top) + 56 (EmptyText: 16+24+16) + 0 (itemSpacing) + 40 (Button) + 8
(slot bottom) = 112, matching both fetched Cards' own measured height —
confirms the reading. The 8px slot padding is **already** supplied by
`Card.tsx`'s own `p-component-sm` (unrelated to this file); the fix is
entirely inside `WinkelmandList.tsx`'s own wrapper `div`:

- Dropped `gap-2` (itemSpacing between EmptyText and Button measures 0 —
  the visual gap in the old build was an unmeasured guess that happened to
  read as plausible spacing, not a real one).
- Dropped `py-4` on the wrapper (that padding belongs to nothing in the
  fetched tree at the wrapper's own level — see the now-superseded #219
  entry above).
- Added `py-component-lg` (bound `spacing/component/padding-lg`, 16px) to
  the `<p>` itself, reproducing `EmptyText`'s own paddingTop/Bottom on the
  node that actually carries it.
- Added `text-center` + `w-full` to the `<p>`, matching the measured
  `textAlignHorizontal: CENTER` + `layoutAlign: STRETCH` — a cosmetic no-op
  for this short, single-line title today (the parent's `items-center` and
  the hugging default already centred it), but now structurally faithful
  instead of coincidentally correct, so it won't silently break if the copy
  ever grows to two lines.

No breakpoint difference in the Type-slot/EmptyText geometry (only the
Button's own `layoutAlign` differs, already built before this ticket).

### Verification

`pnpm lint`/`typecheck`/`test` (417 passed, 3 skipped, incl.
`messages-key-parity`)/`check:raw-spacing`/`check:server-only`/
`check:comment-budget` all green. `pnpm test:visual` run — see the PR body
for the exact result and any regenerated baselines.
