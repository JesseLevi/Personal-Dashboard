# /winkelmand page (`page.tsx` + `WinkelmandList.tsx`)

- **Code:** `app/(app)/winkelmand/page.tsx` (Server Component: fetch + translations), `WinkelmandList.tsx` (`"use client"`, page-level composition; same non-mapped-component precedent as `ReceptenBoard.tsx`, not in `design/figma-map.json`), `app/(app)/winkelmand/actions.ts`, `lib/shopping/queries.ts`.
- **Node IDs (current):** `4051:13049` Desktop/Default, `4051:13040` Mobile/Default, `4052:13700` Desktop/Sort, `4052:13689` Mobile/Sort, `4049:11175` Desktop/EmptyState, `4049:11167` Mobile/EmptyState; breakpoints frame `3778:5816`. The `4044:*` pair from the first build no longer exists (designer replaced the frame set). State mockups `3779:4112`/`3779:3996` (checked rows + slide-to-delete) are screenshot-only references.

Current-state record; ticket history lives in `git log`.

## Composition: no new components

`PageHeader` (title + actions slots), one `Card` per group (`title` = source recipe name / NEVO food group / "Overig"), `CardContentIngredient` rows per group (`divider={index < group.items.length - 1}`), `Button`s and a labelless `Dropdown` in the header. Everything composes existing, storied pieces; no Ladle story (full route body, same precedent as `RecipeDetailPage.md`). The Card's `Settings` (Pas-aan gear) is `visible: false` on every fetched Winkelmand Card: not rendered.

## Server/client split

`page.tsx` fetches `ShoppingListItemWithGroupInfo[]` (`getShoppingListItems()`) and hands plain data to `WinkelmandList.tsx` (house-style thin Server Component + `"use client"` child, not a technical necessity). `WinkelmandList.tsx` calls `useTranslations` client-side for all `shopping.page.*` keys.

## Grouping and data

- **One `Card` per source recipe** (default, "Recept") **or per NEVO food group** ("Voedingsgroep", `category_nl`/`category_en` resolved via `reference_ingredient_id`). Annotation on the Card title (`I4051:13057;3997:25433`): shows the recipe name the ingredients were added from; an individually added ingredient = "Other". `buildGroups()` groups on `recipe_id` / resolved category; items without group identity go into one `__other__` group labelled `shopping.page.otherGroupLabel` ("Overig"/"Other"), **always pushed last** regardless of its first item's position (deliberate: overrides the general position rule for that group only). Other groups keep first-seen order = `position` order from `getShoppingListItems`, no extra sort pass.
- `sendRecipeToShoppingList` sets `recipe_id`; `shopping_list_items.reference_ingredient_id` (nullable uuid FK to `reference.ingredients`, `on delete set null`, nullable so manual / unmatched items resolve to nothing and the `rls-shopping_list_items.sql` fixtures stay valid) is resolved at send time from `lib/recipes/queries.ts`'s `nutritionInputsForIngredients` chain (`recipe_ingredients.ingredient_id` -> `ingredients.reference_id` -> `reference.ingredients.id`), merged first-seen-wins in `lib/shopping/send-to-list.ts`. `lib/database.types.ts` is hand-edited for it (no Docker; keep the cross-schema `Relationships` entry like `ingredients.reference_id`).
- **Read side:** `getShoppingListItems()` resolves recipe `title` and food-group names with **two batched `.in("id", ...)` queries** for the whole list, never per row. **Deliberately not an embedded `.select("*, recipes(title)")`**: without a unique constraint on `recipe_id`, postgrest-js types a forward FK embed as an array (`isOneToOne: false`), and without Docker the emitted type can't be verified; `reference.ingredients` can't be embedded at all (separate schema). Keep the defensive `id != null` filter (not just `!== null`): an un-migrated DB returned `reference_ingredient_id` as `undefined`, and `"undefined"` reached a uuid filter.
- `shopping_list_items.section` is still fetched and unused (`docs/open-questions.md#winkelmand-no-section-grouping`; larger aisle grouping: `#winkelmand-gangpad-grouping-not-built`).

## Header actions (#182, #222)

`PageHeader`'s `<header>` is `flex justify-between`; **actions must be ONE flex child**: a Fragment of siblings spreads them apart (was the desktop misalignment). Wrapper: `<div className="flex items-center gap-inline-sm md:gap-inline-xl">`, matching the `Knoppen` frame (mobile `4051:13045` itemSpacing `spacing/inline/gap-sm` 8px; desktop `4051:13054` `spacing/inline/gap-xl` 20px). `inline-*` tokens don't self-switch, so the `md:` prefix stays. Order in Figma: Plus -> Sort -> Destructive.

- **"Item" (Plus)**: mobile `4109:15948` (icon-only, 40x40), desktop `4052:13677` (`Text: "Item"`, `Icon/Plus`), `variant="filled"`, leading. Two-span pattern (`hidden md:inline` label) with a permanent `aria-label` (accessible name doesn't depend on which span is visible). Key `shopping.page.addItemLabel` = "Item" in both catalogs. Opens the existing `components/organisms/IngredientSearchPanel.tsx` (Figma `3957:10309`/`3957:10337`), reused as `RecipePanel.tsx` does (`level={1}`). `onSearch`/`onCreateOwnIngredient` import `searchIngredients`/`createOwnIngredient` straight from `app/(app)/recepten/actions.ts` (a Server Action is a global RPC reference; no re-export shim). `onSave` (`handleAddIngredients`) calls `addShoppingListItem` **sequentially awaited, never `Promise.all`** (it computes `position` from the current last row server-side; parallel calls can collide; same as `IngredientSearchPanel`'s own `handleSave`). No optimistic row (grouping is resolved server-side); the row appears when `revalidatePath("/winkelmand")` refreshes `items`; failures use `shopping.errors.*`, no invented success indicator. A freshly added row has `quantity: null` so no Tag: expected.
- **Sort**: icon-only on mobile (Figma `4052:13689`: `With text: false`), text span `hidden md:inline`, permanent `aria-label={t("sortLabel")}`. Mobile Figma frames draw its text as "Voeg toe aan mand" (copy-paste override artifact; icon and annotation say sort): built as "Sorteer" at every breakpoint. Two options: `Recept` (`Icon/FolderClosed`, default; annotation: sorts by the recipe the ingredient was added from) and `Voedingsgroep` (`Icon/Broccoli`). **View-only, component-local `useState`, no URL param** (unlike Te-Doen's `?sort=`): resets on reload, deliberate smaller footprint, nothing in Figma asks for persistence.
- **"Leeg mand" (clear all)**: copy is a **user instruction that deviates from Figma**, whose nodes (`4053:14274`/`4053:14285`, plus EmptyState `4050:11567`/`4050:11581`) still carry stale strings ("Verwijder alles"/"Alles verwijderen "). Desktop `clearAllLabel` = "Leeg mand"/"Empty basket", mobile `clearAllLabelShort` = "Leeg"/"Empty" (Figma mobile reads "Leeg " with trailing space, trimmed). Two spans (`md:hidden` / `hidden md:inline`); **never a bare `hidden` on the `Button` root** (`Button`'s `inline-flex` base beats it in cascade order, the #263 trap). The key name `clearAllLabel` is unchanged. Single click, no confirm: `docs/open-questions.md#winkelmand-clear-all-no-confirmation`. Rendered in the header whether the list is empty or not (the EmptyState `Knoppen` frame draws exactly this one Destructive child); only Plus/Sort are conditional on `!isEmpty`. Clearing an empty list is a harmless no-op.

## Sort dropdown (#182)

Reuses `TeDoenHeader.tsx`'s pattern (annotation on `4052:13706`: "exactly like in kanban page"): `relative` wrapper + `useCloseOnOutsidePointerDown` (click-outside closes, no Escape) + labelless `Dropdown` with `shadow-sm`, `w-[209px]`, `z-[999]`, per-option `variant={option === selected ? "filled" : "white"}` + `aria-pressed`. Annotation on the panel slot: stack-margin token + z-index 999, click outside to dismiss.

- Positioning goes through the shared `lib/dom/use-popover-position.ts` with `anchor: { base: "left", md: "right" }` (resolved via `matchMedia` in the hook's measure effect, not at render), clamp-protected. The Sort wrapper stays `relative` at every breakpoint.
- **Desktop:** right edge flush with the Sort button's own right edge (not the group's), pixel-verified against `4052:13700` (0.00px diff at 1440px).
- **Mobile:** Figma draws **no** open-dropdown state; left-anchored to the trigger is the user's call (right-aligning to the group detached the panel from the tapped button): `docs/open-questions.md#winkelmand-mobile-sort-dropdown-anchor-undesigned`. Do NOT hardcode a mobile `left-0` offset again: the earlier fixed offset shipped a regression when #222 shortened the mobile trailing label (`docs/incidents.md`, 2026-08-18) because nothing gates an open-dropdown state. Last live measurement with "Leeg": panel fits at 320/375/390/430px (e.g. 320px: panel 103.00 to 312.00).
- Stacking: the panel rendered behind the rows below it because the rows are `position: relative`; fixed at `PageHeader.tsx` (`z-10` on the sticky header), see `design/notes/PageHeader.md`.
- **Open flag:** at 320px the header row's own content (title + icon-only Sort + clear-all) needs ~339px and overflows regardless of the dropdown: `docs/open-questions.md#winkelmand-mobile-header-content-overflows-320px`. Not fixed, not re-verified with real icons.

## Empty state (#222 pt.5)

`Card` with no `title`/`settings` (the "Stap + Card" frame has no title row), centred "Winkelmand is leeg" (`shopping.page.emptyStateTitle`) and `Button` "Ga naar recepten" (`emptyStateCta`) with **trailing** `Icon/ArrowRight`, `useRouter().push("/recepten")`. Header shows only the clear-all button (see above).

- Button width is per breakpoint, from the fetched geometry: desktop hugs (no `alignSelf` in the centred parent), mobile `alignSelf: stretch` (`4049:11508`; desktop `4050:11596`): `className="w-full md:w-fit"`.
- **Measured Card geometry** (`4049:11174` mobile / `4050:11597` desktop, `"Stap + Card"` -> `"Type"` slot): `Type` slot padding 8px all sides (`spacing/component/padding-sm`, already supplied by `Card.tsx`'s own `p-component-sm`), `itemSpacing` 0; `EmptyText` `paddingTop`/`Bottom` 16px (`spacing/component/padding-lg`), left/right 0, text centred. 8 + 56 (16+24+16) + 0 + 40 + 8 = 112, matches both Cards' height. So the wrapper has **no `gap` and no `py`**; the `<p>` carries `py-component-lg`, `w-full text-center` (structurally faithful if the copy ever wraps). No breakpoint difference besides the Button's `layoutAlign`.

## Spacing and margin (#205, #219)

- **Right margin** is scoped to this page's content, not `main`: `AppShellNav` `<main>` has `pl-4 md:pl-32` and no right padding, and the Te-Doen/Recepten kanban carousel deliberately bleeds off the right edge, so a `main`-level right padding would clip it. Both the empty-state wrapper and the items-list wrapper use `pr-page-right-equal` (matches fetched `Main` padding: desktop `80px 128px`, mobile `16px 16px 80px`, symmetric).
- Items-list wrapper `gap-6` (24px) **stays raw, flagged (`spacing-flag`)**: the "Ingredients" frames (`4051:13534` mobile / `4051:13056` desktop) have `itemSpacing: 24` with **no `boundVariables`** entry (unbound in Figma), and 24px coincides with both `spacing/page/stack` and `spacing/stack/stack-xl`; picking either would be value-matching, not measuring.

## Quantity Tag

The Winkelmand node draws short unit labels and ASCII fractions ("1 cup", "1/4 cup", "2 tbs", "2 scoops"): the `recipes.unitsShort` + `formatQuantityFraction` pair that `RecipeDetailPage.tsx`'s per-*step* Tag uses, not its per-ingredient-card Tag (long labels). `quantityLabel()` handles the independently nullable `quantity`/`unit` (#175, unlike `recipe_ingredients.unit` which is `not null`):
- `quantity === null` -> `undefined` (Tag omitted; no Figma-drawn quantity-less row).
- `quantity` and `unit` set -> `formatQuantityFraction(quantity, unit, tUnitsShort(unit))`.
- `quantity` set, `unit === null` (manually typed, e.g. "melk 2") -> `formatQuantity(quantity, null)`: `formatQuantityFraction` needs a non-null `UnitCode` (fraction choice is `magnitudeOf(unit)`-driven), so plain decimal is the least-invented fallback.

## Row interactions: optimistic, no move queue

`runAction()` snapshots, updates optimistically, calls the server action, reverts and surfaces `shopping.errors.*` on failure; `pendingActions` (a ref *count*, same as `ReceptenBoard`'s `pendingMoves`) guards the `items` -> `localItems` resync against a background revalidation clobbering an in-flight update. **Deliberately no `moveQueue`-style sequential chain**: `ReceptenBoard` serialises moves because each computes `targetIndex` from sibling `position`s; here `toggleShoppingListItem`/`deleteShoppingListItem`/`clearShoppingList` target rows by `id` alone, so concurrent calls can't race.

`swipeAction="delete"`/`onDelete`/`deleteLabel` are passed on every row. `deleteLabel` uses the interpolated key `shopping.page.deleteItemLabel` ("Verwijder {name}"/"Delete {name}") instead of the generic `components.cardContentIngredient.deleteLabel`, so a screen-reader user tabbing to the (keyboard-reachable) delete button hears which item it deletes (not Figma-sourced: Delete is a swipe-revealed state). The swipe reveal's keyboard path and its accepted within-row tab-order trade-off live in `design/notes/CardContentIngredient.md`. Hover must not shift the row on desktop: `CardContentIngredient`'s `handlePointerMove` is gated by an explicit `dragging` flag (details there).

## i18n

`nav.shopping` is the page `<h1>` key, deliberately separate from `components.sidebar.items.shopping` (same value, declared independently, as `nav.recipes` is). All new keys exist in both catalogs (ADR-0007).

## Open flags

- `docs/open-questions.md#winkelmand-clear-all-no-confirmation`, `#winkelmand-no-section-grouping`, `#winkelmand-gangpad-grouping-not-built`, `#winkelmand-mobile-sort-dropdown-anchor-undesigned`, `#winkelmand-mobile-header-content-overflows-320px`.
- Clear-all copy deviates from Figma until the designer updates the nodes (above).
- **Not yet exercised live:** the `reference_ingredient_id` write path and Voedingsgroep grouping with a real resolved category (the migration was applied by hand on 2026-08-09; nobody re-ran the Playwright pass since; see `RecipeDetailPage.md`).
- Verification method note: a live pass needs a throwaway test user created via the Supabase Admin API in a local, uncommitted script (service_role stays out of app code), seeded rows, deleted afterwards.
