# WinkelmandPage
Figma: `Pages/Winkelmand/Breakpoints` `3778:5816` · Desktop/Default `4051:13049`, Mobile/Default `4051:13040`, Desktop/Sort `4052:13700`, Mobile/Sort `4052:13689`, Desktop/EmptyState `4049:11175`, Mobile/EmptyState `4049:11167`; state mockups `3779:4112` / `3779:3996` (checked rows, slide-to-delete; screenshotted only). The #177-era `4044:*` frames no longer exist. · Code: `app/(app)/winkelmand/page.tsx` (Server Component: fetch + title), `WinkelmandList.tsx` (`"use client"`, page-level composition, not in `design/figma-map.json`), `actions.ts`, `lib/shopping/queries.ts`

## Anatomy
No new components. `PageHeader` (actions in one flex wrapper), one `Card` per group (`title` = recipe name / NEVO food group / "Overig"), `CardContentIngredient` rows with `divider` on all but the last and `swipeAction="delete"`. Header buttons: "+ Item" (filled, `Plus`), Sort (`ArrowUpDown` plus a labelless `Dropdown`), destructive "Leeg mand" (`Trash`). Empty state: untitled `Card` with a Hairline `Basket` figure, centred title, and a trailing-`ArrowRight` CTA to `/recepten`.

## Deliberate decisions
- Grouping (`buildGroups`): by `recipe_id` ("Recept", default) or by `reference.ingredients` `category_nl/en` ("Voedingsgroep"). Items without identity go into one `__other__` group ("Overig"), always last; other groups keep first-seen (`position`) order. The annotation says individually added items are "Other"; generalised to the food-group axis (#179).
- Read side resolves recipe titles and food-group names with two batched `.in("id", ...)` queries, never per row and never an embedded `select("*, recipes(title)")` (postgrest-js types a non-unique forward FK embed as an array, unverifiable without Docker; `reference` is a separate schema and cannot be embedded). `reference_ingredient_id` is nullable (`on delete set null`), set at send time via `nutritionInputsForIngredients` / `send-to-list.ts`; `getShoppingListItems` filters with `id != null`, not `!== null`, because an un-migrated DB returned `undefined` and an `"undefined"` string reached a uuid filter (#179).
- Sort choice is component-local `useState`, no `?sort=` URL param (unlike Te-Doen): nothing asks for it to survive reload. The dropdown reuses `TeDoenHeader`'s pattern (outside-pointerdown closes, no Escape, `z-[999]`, `w-[209px]`, `shadow-sm`, per-option `filled`/`white` + `aria-pressed`) as the annotation says "exactly like in kanban page" (#179).
- Figma's mobile Sort text reads "Voeg toe aan mand" (copy-paste artifact); built as "Sorteer" everywhere (#179).
- Header buttons live in one flex wrapper: a Fragment passed to `actions` renders as flat siblings and `PageHeader`'s `justify-between` spreads them apart (#182).
- Sort is icon-only below `md` (`hidden md:inline` span inside the Button) with a permanent `aria-label`, so the accessible name never depends on which text is visible. "+ Item" and "Leeg" follow the same two-span pattern; never a bare `hidden` on a `Button` root (cva `inline-flex` wins in the cascade, the #263 trap; `md:` variants win) (#182, #222).
- "Leeg mand" copy is a user instruction that deviates from Figma, which still draws "Verwijder alles" (`4053:14274` / `4053:14285`) and "Alles verwijderen " in the EmptyState frames. Desktop `clearAllLabel` = "Leeg mand" / "Empty basket"; mobile `clearAllLabelShort` = "Leeg" / "Empty" (Figma mobile `Text#3632:5` = "Leeg "). Key names kept across three copy changes (#179, #222).
- Clear-all is a single click, no confirm: Figma draws none, and importing the recipe-detail two-step confirm uninvited is an invention (#177).
- Sort dropdown anchor: wrapper stays `relative` at every breakpoint; `usePopoverPosition` with `anchor: { base: "left", md: "right" }`, `prefer: "below"`. Left-anchored to the trigger on mobile by user decision (Figma draws no open mobile dropdown; right-aligning to the group put the panel far from the tapped button); desktop `right` anchor is flush with the Sort button's right edge (measured 0.00px diff at 1440px). The hook clamps to the viewport; a fixed-offset anchor broke when #222 shortened the trailing label (`docs/incidents.md`, 2026-08-18) (#182).
- "+ Item" opens the existing `IngredientSearchPanel` (`onSearch`/`onCreateOwnIngredient` imported straight from `recepten/actions`, no re-export shim). `onSave` calls `addShoppingListItem` once per row, sequentially awaited, because it computes `position` from the current last row server-side and parallel calls would collide. No optimistic row (group info is server-resolved); failure sets `actionError`, no invented success. Hand-typed names are added by name only, no `reference_ingredient_id` written (#222, #324).
- A freshly added ingredient has `quantity: null`, so `quantityLabel()` returns `undefined` and no Tag renders. Expected, not a bug (#222).
- EmptyState header: Figma's `Knoppen` there draws only the destructive button, but by user instruction "+ Item" is also shown (icon-only on mobile). Only Sort is hidden when empty. Clear-all on an empty list is a harmless no-op (#222).
- Empty-state `Basket` is a Hairline figure whose six theme properties bind semantic tokens; not in Figma, user-requested (#369).
- Quantity Tag uses short unit labels and ASCII fractions (`recipes.unitsShort` + `formatQuantityFraction`, "1/4 cup"), as the node draws, not the recipe ingredient-card long form. `unit === null` falls back to plain-decimal `formatQuantity` (fractions need a unit magnitude) (#177).
- `runAction()` is optimistic: snapshot, update, call, revert plus `shopping.errors.*` on failure. `pendingActions` is a ref count guarding the `items` -> `localItems` resync against revalidation clobbering an in-flight update. No `moveQueue`: every action targets by `id` with no neighbour-relative math, so concurrent calls cannot race (#177).
- Per-row delete label is the interpolated `shopping.page.deleteItemLabel` ("Verwijder {name}"), not the generic `cardContentIngredient.deleteLabel`, so a keyboard user hears which item (#177).
- Right margin (`pr-page-right-equal`) is on this page's own wrappers, not `main`: the kanban carousel deliberately bleeds off the right edge and `main` padding would clip it (#179, #205).
- Actions row gap: `gap-inline-sm md:gap-inline-xl` from "Knoppen" (`4051:13045` mobile, `4051:13054` desktop `itemSpacing`). These do not self-switch, so keep the `md:` prefix (#219).
- Empty-state Card geometry (read via `boundVariables` on `4049:11174` / `4050:11597`): `Card`'s `p-component-sm` is the Type slot's 8px; text-to-Button `itemSpacing` is 0 (no `gap`); the `<p>` carries `py-component-lg` (EmptyText's `spacing/component/padding-lg`), `text-center`, `w-full`; total 112px. Button `w-full md:w-fit` (mobile stretches, desktop hugs). Corrects an earlier #219 "stays raw" call that compared the wrong box (#222, #219).

## Token gaps and flags
- Items-list wrapper `gap-6` (24px): "Ingredients" wrapper (`4051:13534` mobile / `4051:13056` desktop) has `itemSpacing: 24` with no `boundVariables`; 24 matches both `spacing/page/stack` and `spacing/stack/stack-xl`, so it stays raw (#219).

## Gotchas
- `PageHeader`'s `z-10` is what keeps the `z-[999]` Sort panel above the `position: relative` swipe wrappers of later rows (`design/notes/PageHeader.md`) (#179).
- Swipe-to-delete keyboard path and the hover-versus-drag fix live in `design/notes/CardContentIngredient.md`, not here. The header row overflows horizontally below about 339px regardless of the dropdown (open item below).

## Open
- `docs/open-questions.md#winkelmand-no-section-grouping` (`shopping_list_items.section` is still fetched but unread)
- `docs/open-questions.md#winkelmand-clear-all-no-confirmation`
- `docs/open-questions.md#winkelmand-mobile-sort-dropdown-anchor-undesigned`
- `docs/open-questions.md#winkelmand-mobile-header-content-overflows-320px`
- `docs/open-questions.md#winkelmand-empty-state-add-button-not-in-figma`
