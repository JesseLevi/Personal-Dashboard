# /winkelmand page (`page.tsx` + `WinkelmandList.tsx`)

- **Code:** `app/(app)/winkelmand/page.tsx` (Server Component, fetch + translations), `WinkelmandList.tsx` (`"use client"`, page-level composition — same non-mapped-component precedent as `ReceptenBoard.tsx`, not added to `design/figma-map.json`), `app/(app)/winkelmand/actions.ts` (#176, unchanged by this ticket).
- **Node IDs (fetched via MCP for #177):** Desktop `4044:10838` ("Winkelmand/Desktop"), Mobile `4044:10830` ("Winkelmand/Mobile"). State mockups (checked rows + slide-to-delete, no "Winkelmand" title): `3779:4112` (desktop) / `3779:3996` (mobile) — screenshotted, not code-fetched, since #160 already built exactly the state they show.

Built #177. Fetched all nodes live via `get_design_context` (desktop/mobile) and `get_screenshot` (the two state mockups) before writing any UI.

## Composition — no new components

Literal read of the fetched nodes: `PageHeader` (title + actions slots = the "Header" frame exactly), one `Card` (no `title`/`settings`/`step` — the fetched node's `Card` instance renders no title row at all, just the bordered row list), N `CardContentIngredient` rows (`divider={index < items.length - 1}`, matching the fetched border-b-on-all-but-last pattern), `Button variant="destructive" icon="Trash"` for "Alles verwijderen". No new atom/molecule/organism — everything in `WinkelmandList.tsx` composes existing, already-storied pieces, same "full route body, not a self-contained overlay" precedent `RecipeDetailPage.md`'s own "Ladle — no new story" section gives for skipping a new Ladle story here too.

## Server/client split

Identical shape to `ReceptenBoard.md`: `page.tsx` fetches `ShoppingListItemRow[]` (`getShoppingListItems()`, #176) and translated strings, and hands only that plain data to `WinkelmandList.tsx`. Nothing here needed a function-prop boundary the way `ReceptenBoard.tsx`'s `renderItem` did — this split follows the same house-style precedent (thin Server Component fetch, "use client" child owns interaction), not a technical necessity of this particular page.

## Quantity Tag — short unit labels + ASCII fractions, not the ingredient-card long form

`RecipeDetailPage.tsx`'s own ingredient-card Tag uses `recipes.units` (long labels: "Cup", "Tablespoon") via `formatQuantityFraction`. The Winkelmand node draws the opposite: fetched Tag text reads "1 cup", "1/4 cup", "2 tbs", "1 tsp", "1/2 cup", "2 scoops" — abbreviated labels and ASCII fraction notation, i.e. the same `recipes.unitsShort` + `formatQuantityFraction` pair `RecipeDetailPage.tsx`'s per-*step* Tag uses, not its per-ingredient-card Tag. Built to match this ticket's own fetched node directly (`CLAUDE.md`: fetch, don't guess from another page's precedent) rather than copying the other page's convention.

`quantityLabel()` (`WinkelmandList.tsx`) handles the schema's two independently-nullable columns `shopping_list_items.quantity`/`unit` (#175 — unlike `recipe_ingredients.unit`, which is `not null`):
- `quantity === null` → `undefined` (Tag omitted — the prop is optional, per the ticket's own instruction; no Figma-drawn "quantity-less" row exists to verify a rendered fallback against).
- `quantity` set, `unit` set → `formatQuantityFraction(quantity, unit, tUnitsShort(unit))`, matching the fetched fraction+short-label Tags above.
- `quantity` set, `unit === null` (a manually-typed item like "melk 2", once a manual-add UI exists — see `docs/open-questions.md#winkelmand-no-manual-add-entry-point`) → `formatQuantity(quantity, null)`, `units.ts`'s own plain decimal formatter — `formatQuantityFraction` requires a non-null `UnitCode` (its fraction-vs-decimal choice is `magnitudeOf(unit)`-driven, and there is no magnitude without a unit), so a unit-less quantity can't use it. Plain decimal is the least-invented fallback: no unit to derive a fraction-appropriate magnitude from, so no fraction ladder is attempted.

## Row interactions — optimistic, no move queue

`WinkelmandList.tsx`'s `runAction()` is a smaller sibling of `ReceptenBoard.tsx`'s `handleMove`: snapshot-before, optimistic update, call the server action, revert + surface `shopping.errors.*` on failure, `pendingActions` (a ref *count*, same reasoning as `ReceptenBoard.tsx`'s `pendingMoves`) guards the `items` prop → `localItems` resync against a background revalidation clobbering an in-flight update. **Deliberately no `moveQueue`-style sequential chain**: `ReceptenBoard.tsx` serializes `moveRecipe` calls because each one computes `targetIndex` against sibling `position` values that a second, still-in-flight move could invalidate. Every action here (`toggleShoppingListItem`/`deleteShoppingListItem`/`clearShoppingList`) targets a row (or all rows) by `id` alone with no neighbour-relative math, so two concurrent calls can never race each other's computation — firing them independently is correct, not a shortcut.

`swipeToDelete`/`onDelete`/`deleteLabel` are passed on every row — #177 is `swipeToDelete`'s first real UI consumer (built in #160, exercised only by a Ladle story until now).

## `deleteLabel` — per-row, not the generic ingredient string

`components.cardContentIngredient.deleteLabel` ("Ingrediënt verwijderen"/"Delete ingredient") already exists and is generic — it doesn't name which row. Judgment call: this page uses a new interpolated key instead, `shopping.page.deleteItemLabel` ("Verwijder {name}"/"Delete {name}"), so a screen-reader user tabbing to a row's (now keyboard-reachable, #177's `CardContentIngredient.md` fix) delete button hears which item it deletes — the same reasoning `CardContentIngredient.md` already gives for the row's own `Checkbox` using the ingredient's `name` as its accessible name, extended to the delete button now that it has a real keyboard path. Not a Figma-sourced string (the fetched node has no per-row delete label to read at all, since Delete is a swipe-revealed state); both catalogs carry the new key, ADR-0007.

## "Alles verwijderen" — literal single-click read, no invented confirm

See `docs/open-questions.md#winkelmand-clear-all-no-confirmation`. Built exactly as the fetched header shows (one destructive `Button`, no confirm state) rather than importing `RecipeDetailPage.tsx`'s two-step confirm pattern uninvited — the ticket's own instruction was to flag this gap, not resolve it with an invented pattern.

## Empty state — placeholder, flagged

See `docs/open-questions.md#winkelmand-empty-state-undesigned`. `shopping.page.emptyStateText`, plain `<p>`, `text-text-muted`, no card/border/icon — deliberately minimal since nothing in Figma specifies a real one.

## Section grouping and manual add — not built, both flagged

`shopping_list_items.section` (#175) is fetched and passed straight through by `getShoppingListItems()` but never read by this page — no query filters/groups by it, no UI renders it. `addShoppingListItem` (#176) has no UI call site anywhere in this ticket. Both are stated ticket scope boundaries with a real Figma gap behind them, not oversights — see `docs/open-questions.md#winkelmand-no-section-grouping` / `#winkelmand-no-manual-add-entry-point`.

## Keyboard-accessible swipe-to-delete — assessed, fixed

`design/notes/CardContentIngredient.md`'s #160 entry flagged the swipe reveal's missing keyboard path and named this ticket as "the moment" to address it. Assessed and fixed at the molecule (not worked around at this page) — full reasoning, the fix itself, and its one accepted trade-off (within-row tab order) are recorded in `CardContentIngredient.md`'s own "#177" entry, not duplicated here.

## `nav.shopping` — new key, mirrors the Sidebar's existing label

`components.sidebar.items.shopping` ("Winkelmand"/"Shopping basket") already existed (#88) for the Sidebar row; this page's own `<h1>` needed its own translation key rather than importing a `components.sidebar.*` string into a page title (same separation `nav.recipes` already keeps from `components.sidebar.items.recipes`, both independently declared with the identical value) — `nav.shopping` added, same value both places by construction, not by a shared reference.

## Verification

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` run — see the PR for exact numbers. `pnpm test:visual` not run: no story was added or changed, and `CardContentIngredient.tsx`'s own fix touches no static-render CSS/pixels (see that file's own note). **Not run: a real authenticated `/winkelmand` route in a browser** — this dev machine has no Docker/local Supabase (`CLAUDE.md`), the same standing gap every Phase 3/4/5 page has hit (`docs/HANDOFF.md`). Nothing about the real checked/toggle/delete/clear round trip, the empty-list placeholder against real zero-row data, or the on-screen quantity formatting against real seeded rows has been exercised.
