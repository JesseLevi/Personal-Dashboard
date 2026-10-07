# RecipeDetailPage (`/recepten/[recipeId]`)

- **Code:** `app/(app)/recepten/[recipeId]/page.tsx` (Server Component: fetch + `notFound()`), `RecipeDetailPage.tsx` (`"use client"`, page-level composition — same non-mapped-component precedent as `ReceptenBoard.tsx`/`RecipePanel.tsx`, not added to `design/figma-map.json`).
- **Node IDs (V2, current — #160):** `3997:14736` (section), `3997:14737` (Mobile) / `3997:15171` (Desktop), `3997:15948`/`3997:15543` (NutritionalData row), `3997:25600`/`3999:10604` (PasAan overlay) with panels `3998:10701` (pull-up) / `3999:10877` (slide-in).
- **Node IDs (V1, superseded — #127/#128/#153):** `3778:5427` (Mobile, 402px), `3778:5584` (Desktop, 1440px), `3953:9750`/`3778:5596` (portion row, already `design/notes/PortionStepper.md`'s), `3778:5437`/`3778:5600` (ingredient cards), `3778:5459`/`3778:5622` + `3778:5467`/`3778:5630` (step cards).

Built #127. Fetched all nodes live via `mcp__figma__get_figma_data` before writing any UI.

## Shell reuse — no new header/sidebar chrome

`AppShellNav.tsx` (#88/#101) already renders the persistent desktop `Sidebar` (collapsed rail) and the mobile floating `Icon/Panel-left-open` button (`3778:5429`'s own node) around every `(app)` route, and `main`'s own padding (`pt-4 pb-20 pl-4 md:pt-20 md:pb-20 md:pl-32`) already matches this page's own Figma "Main" padding on three of four sides. This page only adds the missing `pr-4 md:pr-32` half (same values `PageHeader.tsx` already applies for the same reason) on its own root wrapper — nothing here duplicates the shell.

## No `PageHeader` — literal structural read

Figma's header row (`3778:5430`/`3778:5587`) has no `<h1>` slot at all (back-arrow left, a buttons row right); the recipe title renders separately, centered, below the hero image. Reusing `PageHeader` (title-left/actions-right) would have imposed a shape this screen doesn't have. Built as a plain `flex justify-between` row instead.

## "Voeg toe aan mand" — real handler since #178

Phase 4 (#127) shipped it rendered-but-`disabled` (binding user decision 2026-07-29) since no `shopping_list_items`/write path existed yet. **#178 (Phase 5 slice 4) wires it for real**, unchanged geometry/label: `onClick` calls `handleSendToList`, which sends `{ recipeId: recipe.id, targetPortions: portions }` to `sendRecipeToShoppingList` (`app/(app)/winkelmand/actions.ts`) — the page's own session `portions` state (#128/#160, display-only), never `recipe.servings`. A dedicated `useTransition` (`sendPending`) disables the button while the action is in flight, kept separate from `handleDelete`'s own `isPending` since the two actions render in different branches and have no reason to share one pending flag.

The action loads the recipe server-side (ownership via `getRecipeWithIngredientsAndSteps`'s existing RLS + `user_id` filter, never service_role), scales+merges via the new pure `lib/shopping/send-to-list.ts` (`buildShoppingListLines`, reusing `scaleIngredientRows` — no arithmetic reimplemented), and inserts the resulting lines with `recipe_id` set for provenance, appended after the user's existing Winkelmand items.

**No success/confirmation feedback and no ingredient-subset picker** — both are Figma/Vision.md gaps, not omissions: `docs/open-questions.md#winkelmand-send-no-success-feedback` / `#winkelmand-send-no-subset-picker`. Whole-recipe send only.

## No category tags — deliberate, not an omission

No category `Tag` row appears anywhere in any fetched node, V1 or V2, even though `recipe_categories` exists in the schema. Not built — a Figma-recorded scope boundary, not a gap.

**Duration/time was in this list until #160.** V1's nodes drew no `Icon/Timer`+minutes either; V2's `NutritionalData` row does, so `recipes.time_minutes` is now rendered — see the V2 rework section below.

## Mobile Ellipsis overflow menu — undesigned, least-inventive fill

`3778:5434` is an icon-only `Icon/Ellipsis` `Button` with no annotation and no panel anywhere in the file (unlike desktop's two real, separately-styled `Button` instances). Built as `TeDoenHeader.tsx`'s own board-switcher/sort menu pattern: an icon-only trigger owning a local `overflowOpen` boolean, `aria-expanded`, a `pointerdown`-outside-closes effect (copied inline here, same shape as `TeDoenHeader.tsx`'s `useCloseOnOutsidePointerDown` — not extracted to a shared hook for one extra call site), and an absolutely-positioned `Atom/Dropdown` in its labelless "static bordered panel of `Button` rows" mode holding "Bewerken" (`variant="white"`)/"Verwijderen" (`variant="destructive"`). No new menu component — reuses `Button`+`Dropdown` exactly as `TeDoenHeader.tsx` already does. Flagged: `docs/open-questions.md#recipe-detail-mobile-overflow-menu-undesigned`.

## Delete confirmation — #94 precedent, moved from panel footer to page header

No confirmation dialog is modelled anywhere in Figma for either "Verwijderen." Follows `CardDetailPanel.tsx`'s #94 precedent (two-step: click Verwijderen swaps to "Weet je het zeker?" + Annuleren/Ja-verwijderen, no `window.confirm`, no second dialog) — adapted from a `SidePanel` footer to this page's own header row, since there is no panel/footer context here. The confirm row uses `flex-wrap` rather than a hard mobile/desktop branch, so it reflows under real content rather than needing a second layout path. Both the desktop header's standalone Verwijderen button and the mobile overflow menu's Verwijderen row set the same `deleteConfirming` state — one confirm UI, two triggers.

`handleDelete` calls `deleteRecipe` directly and, on success, `router.push("/recepten")` (the just-deleted recipe's own route can no longer resolve). On failure, the error renders inline below the header via `recipes.errors.*`, matching every other action call site in this codebase.

## `group_label`-less ingredients — default "Ingrediënten" heading (reversed #166)

**Superseded by #166 — was "no group heading, not a default label".** #160's original reasoning (kept below for the record) treated an untitled `Card` as the literal behaviour `Card`'s optional `title` already models, and inventing a default label as UI content Figma never draws. User feedback in #166 overruled that directly: "Ingrediënten title in dev niet zichtbaar. Maak standaard ingrediënten" (the ingredients title isn't visible in dev; make it default to "Ingrediënten") — an explicit product instruction, not a fresh Figma read (no sampled instance in the file shows an ungrouped ingredient list, since the seeded/sample recipes all carry a real `group_label`). `group.groupLabel ?? t("ingredientsDefaultTitle")` now supplies the localised fallback ("Ingrediënten"/"Ingredients", both catalogs) instead of `?? undefined`. Still one shared bucket per `null`-label ingredient (unchanged from #160) — only its title changed, not its grouping/merge behaviour, which the paragraph below still describes accurately.

**#160's original reasoning, for the historical record:** ingredients with a `null` `group_label` render inside one shared `Card` (no "Overig"/"Other" label invented) rather than being hidden or scattered — `Card`'s own `title` prop is optional/boolean-gated in Figma (`Title` bool + `Text`), so omitting it for a group with no name was read as the literal behaviour the atom already models. Groups render in first-seen order (by `position`); a `group_label` value that recurs non-contiguously merges into its first occurrence's bucket rather than opening a second card with the same title — an edge case with no real-world likelihood (a user re-using "Wet" twice non-adjacently) rather than a designed behaviour.

## Ingredient row divider — superseded by #160

**#127's rule (a bottom rule on every row, last row included) no longer holds.** Figma removed the border from `Card-content/Ingredient` itself in V2; the rule is now drawn *between* rows only, with none above the first or below the last. This page passes `divider={index < group.ingredients.length - 1}` accordingly. The measurement history and the ownership decision live in `design/notes/CardContentIngredient.md`'s #160 entry — not repeated here.

## Step ingredient tags — real, shipped #153, closes the #127 gap

#127 shipped `withIngredientTags={false}` on every step because `recipe_steps` carried no FK/join to `recipe_ingredients` at the time. #149 added `recipe_step_ingredients` and `getRecipeWithIngredientsAndSteps` now returns each step as `RecipeStepWithIngredients` (`ingredientIds: string[]`, ordered by the link's own `position`) — only this page's render call was stale, not the schema. `docs/open-questions.md#recipe-step-ingredient-tags-no-data-link` is resolved/removed by this ticket.

Both fetched nodes' step-2 (`3778:5467`/`3778:5630`) draw each `Slot`'s `Tag` instances as a single combined string — `"2 tbs Chia Seeds"`, `"1 Banana"`, `"375 ml Non Dairy Milk"` — i.e. **quantity+unit+name in one Tag**, not name alone. Built to match: `${formatQuantity(quantity, tUnits(unit))} ${name}`.trim-equivalent (quantity-less ingredients — `formatQuantity` returns `""` — fall back to name only, so no leading space/orphan number). Both nodes' Tag instances resolve to `Color=Grey` (`fill_aa157800` `#F5F5F4` bg / `fill_974f0cf9` `#79716B` text) — exactly `Tag`'s existing `neutral` variant (`bg-surface-muted`/`text-text-muted`), no gap.

`ingredientIds` are looked up in `recipe.ingredients` (a step never carries a second copy — `RecipeStepWithIngredients`'s own doc comment already mandates this), via a `Map` built once per render; an id with no matching row (shouldn't happen, FK-enforced) is silently dropped rather than crashing. A step with an empty resulting list renders `withIngredientTags={false}` (no empty tag strip), matching every other step in both fetched nodes that has the boolean `false` (e.g. step 1, `3778:5459`/`3778:5622`).

Order preserved as returned (the join's own `position`), matching the "ordered by the link's own position" comment on `RecipeStepWithIngredients` — not re-sorted or deduplicated against the ingredient list's own `position`.

## Portion stepper — display-only local state, floor of 1 since #153, live-scaled since #128

`PortionStepper` (#123) is rendered with `recipes.servings` as its initial value and a plain `useState`/`onChange` pair. `page.tsx` keys `RecipeDetailPage` on `recipe.id`, so this (and every other piece of local state) resets deterministically if a future ticket ever links one recipe detail page directly to another's — no in-app UI does that today.

#153 (2026-08-02, user feedback: "Personen teller kan op dit moment naar -x personen") added the floor: `PortionStepper` itself now clamps/disables at its own `min` prop (default `1`), so this page needed no change to enforce it — see `design/notes/PortionStepper.md` for why the clamp lives in the atom rather than in this page's `onChange`.

**#128 (2026-08-03) wires `portions` to the actually-rendered quantities**, closing the gap #153 above still described (stepper moved the number, ingredient text didn't). New pure module `lib/recipes/scaling.ts` (`scaleIngredientRow`/`scaleIngredientRows`) maps #120's `scaleQuantity` over `recipe.ingredients` from `recipe.servings` → `portions`; this page computes the scaled list once per render (`scaledIngredients`) and feeds it to both call sites the ticket's Dev Mode annotation names — the `CardContentIngredient` list and the per-step `Tag`s — via the same `ingredientsById` lookup #153 already built, so both stay in sync from one source instead of two independent scale calls. `editTarget`'s `recipe` is deliberately **not** swapped for the scaled list — "Bewerken" must show/edit the real stored quantities, not the on-screen multiplied ones.

- **Display-only, confirmed, not relitigated:** no server action, no `recipes.servings` write — the multiplier is purely local state, resets on navigation, exactly the behaviour #153 already described and #128's own ticket body reconfirms (`Architecture.md` §4.2: the shopping list resolves at send-time, not at view-time).
- **Decimals, not fractions — user decision, 2026-08-03:** `formatQuantity`'s existing decimal output ships unchanged (`docs/open-questions.md#fraction-notation-vs-decimal-formatter`, now resolved for this ticket specifically — a vulgar-fraction renderer is deferred to its own ticket, the design-vs-build gap itself stays open there).
- **No conversion toggle — confirmed out of scope:** `lib/recipes/scaling.ts` imports nothing from `convert()` (unit↔unit within a magnitude) or `lib/recipes/mass-resolution.ts` (ADR-0011 §3's ingredient-specific mass resolution). Both exist and both work; neither has a Figma-designed UI entry point on this page, so neither is called here — see the shared open question above.
- **Never throws in a render path:** `scaleQuantity` throws `InvalidPortionCountError` for a non-positive/non-finite portion count. `recipes.servings` is DB-guaranteed `> 0` (`check (servings > 0)`, `supabase/migrations/20260730000002_recipe_schema.sql`) and `PortionStepper` floors at 1 (#153), so this should be unreachable in practice — but `scaleIngredientRow`/`scaleIngredientRows` still catch `InvalidPortionCountError` and fall back to the row's own unscaled `quantity` rather than let a render crash the page if either guarantee is ever violated. See the module's own header comment for the full reasoning.
- **Client boundary — deviation from the ticket's own ask, deliberate:** the ticket asks for a narrow client island around just the stepper/quantities. `RecipeDetailPage.tsx` shipped as a full `"use client"` component in #127 because edit/delete/router already need client state at the page level, and re-splitting a merged, approved page for this ticket alone is out of scope. The load-bearing rule this exists to protect (ADR-0002/0003: no client-side Supabase access) is already satisfied regardless — `recipe`/`categories`/`thumbnailUrl` still arrive as props from the server component (`page.tsx`), scaling still runs client-side over already-fetched data, no new Supabase call is added anywhere in this component.
- Vitest: `tests/recipes-scaling.test.ts` covers the row-level wiring (ordinary scale up/down, a `count` unit, `quantity === null`, a fraction-ish design value, target === source no-op, the `InvalidPortionCountError` fallback) — the arithmetic itself (rounding, the same null/count cases, the error itself) is already fully covered by `tests/recipes-units.test.ts` against `scaleQuantity` directly and isn't re-tested here.

## Hero image — real signed thumbnail since #153, 2:1 at every breakpoint

#127 shipped only a `bg-surface-muted` placeholder box (`recipes.thumbnail_path` unconsulted). #153 (user feedback: "image banner mist... Image ratio moet 2:1... Zelfde image als thumbnail van invoerveld") resolves it for real: `app/(app)/recepten/[recipeId]/page.tsx` calls `getRecipeThumbnailSignedUrl(recipe.thumbnail_path, 3600)` server-side (same private-bucket/3600s-expiry reasoning `app/(app)/recepten/page.tsx`'s own #149 comment already gives for the board cards) and passes the result down as a new `thumbnailUrl` prop. A plain `<img>` (this codebase's convention, no `next/image` config exists) renders `object-cover` inside an `aspect-[2/1]` box; no photo keeps the same `aspect-[2/1] bg-surface-muted` box so the layout never jumps. Alt is empty/decorative (`alt=""`) — `recipe.title` already renders as an adjacent `<h1>` right below, the same reasoning `CardContentRecipe.tsx` uses for its own thumbnail.

**DEVIATION vs. the fetched geometry — smaller than it looks, not a real override.** Both nodes (`3778:5427` mobile / `3778:5584` desktop) draw the hero as a fixed-height `RECTANGLE` (`"image 63"`, `scaleMode: FILL`/`objectFit: cover`, `borderRadius: 12px` — already `object-cover`/`rounded-xl`, no gap there) inside `Main`'s own fill-width column:
- **Mobile**: `Main` padding `16px 16px 80px` on a 402px frame → content width 370px; image height fetched as exactly **185px**. `370 / 185 = 2.0000` — the mobile node already draws exactly 2:1. No deviation here at all.
- **Desktop**: `Main` padding `80px 128px` on a 1440px frame, image height fetched as **556px**. Desktop's actual content width depends on the collapsed `Sidebar`'s own rendered width, which isn't a resolved pixel in this fetch (Sidebar is `hug`-sized); `Sidebar.md`'s own ~73px collapsed-rail figure would put content width at ≈1111px, i.e. `1111 / 556 ≈ 2.0` — near-exact, not measured to a precise fraction here.
- Per the user's explicit instruction, `aspect-[2/1]` ships uniformly at both breakpoints regardless — this is recorded as a confirmation the ask already matches the fetched geometry (at least at mobile) rather than a real content-vs-shipped mismatch, unlike a normal Figma-contradicts-the-ticket deviation. User-ordered 2026-08-02 via #153, either way.
- **Also flagged, not investigated further**: #127's own prior entry here recorded the placeholder at 146.4px (mobile) / 440px (desktop) — neither number matches this fresh fetch's 185px/556px. Left as an honest inconsistency (a prior mis-measurement, or the file was edited since) rather than a claim about which was ever right.

"Zelfde image als thumbnail van invoerveld add recipi" (same image as the add-recipe upload field's thumbnail): this page already renders `recipes.thumbnail_path` — the same column `RecipePanel`'s `ImageUploadField`/`uploadRecipeThumbnail` writes — through the same `getRecipeThumbnailSignedUrl` helper the overview board already uses, so it is by construction the same stored photo, not a second image concept.

## "Bewerken" — reuses `RecipePanel` in `edit` mode, closes an open question

Opens the same `app/(app)/recepten/RecipePanel.tsx` (#126) `SidePanel` this app already ships, in `{ mode: "edit", recipe }` — the exact shape its `Filled` Ladle story already exercised. Closes the `recipe-edit-trigger-no-host-yet` open question, which this ticket removed from `docs/open-questions.md` (`design/notes/RecipePanel.md` updated to match). `categories` is fetched via the same `getRecipeCategoriesWithRecipes()` `ReceptenBoard.tsx` already calls (heavier than strictly needed — it nests each category's `recipes` — but avoids adding a second, near-duplicate category query for one caller).

**Known redundancy, not a bug:** `RecipePanel`'s own edit-mode footer still renders its own "Verwijderen" (unchanged, #126 behaviour) — opening "Bewerken" surfaces a second delete affordance alongside this page's own header Verwijderen. Both ultimately call the same `deleteRecipe` action; this page's `onDeleteRecipe` prop wraps it with the same `router.push("/recepten")` redirect on success (rather than `RecipePanel`'s normal `onMutated={() => router.refresh()}`, which would `router.refresh()` a route whose recipe no longer exists) — so both entry points behave identically on delete.

## `notFound()` — first real use in this codebase

No prior route needed it. `getRecipeWithIngredientsAndSteps` already returns `null` for "doesn't exist," "not this user's" (RLS) and "signed out" alike (its own doc comment) — `page.tsx` calls Next.js's standard `notFound()` for all three, the plain framework idiom rather than a bespoke empty state, since no ticket or precedent asked for anything else.

## Ladle — no new story, motivated

This file composes only existing, already-storied atoms/molecules (`Card`, `CardContentIngredient`, `CardContentStep`, `Button`, `Dropdown`, `PortionStepper`) with no extracted reusable unit of its own (the ingredient-group and step cards are inline JSX, not a new component). Same shape as `ReceptenBoard.tsx` — a full route body, not a self-contained overlay like `RecipePanel.tsx`/`CardDetailPanel.tsx`/`CategoryPanel.tsx` (which get stories precisely because they render standalone inside a `SidePanel`) — so, following that same precedent, no story was added here.

## V2 rework (#160 part 2) — Figma "Pages/Recept_V2/Breakpoints" (`3997:14736`)

Fetched all four frames live (`3997:14737` Mobile, `3997:25600` Mobile/PasAan/Dropdown, `3997:15171` Desktop, `3999:10604` Desktop/PasAan/Dropdown) plus Dev Mode annotations via the REST API (`get_figma_data` drops them, per `docs/guides/ui-components.md`). Structurally V2 changes three things versus #127/#128/#153's V1: a `NutritionalData` row replaces the portion stepper directly under the title, the ingredients `Card` gains a `Settings` boolean opening a new "Pas aan" panel, and that panel is where servings/unit-system now live. Header/Knoppen, the 2:1 hero, ingredient/step card geometry, and the disabled "Voeg toe aan mand" button are all unchanged from V1 — re-fetched and confirmed, not re-documented here.

### NutritionalData row — six buttons, one new component

`app/(app)/recepten/[recipeId]/NutritionalDataRow.tsx` (page composition, no `figma-map.json` entry — same precedent as this page's own Header/Knoppen rows, which are also plain Figma FRAMEs, not fetched components). Six `Button/Default` pills (mobile `3997:15948`, wraps, `justify-center`; desktop `3997:15543`, single row, `justify-start`): Timer/60 min, Flame/cal, Wheat/carbs, BicepsFlexed/protein, Droplet/fat, User/servings. Icons verified path-for-path against the fetched vectors — `design/notes/Icon.md`'s #160 entry.

- **Time** comes from `recipes.time_minutes` (real, nullable column — #127's own note already flagged its *absence* in V1 as "a Figma-recorded scope boundary, not a gap"; V2 draws it, so it's now built).
- **Calories/Koolhydraten/Proteïne/Vet** come from part 1's `computeRecipeNutritionPerPerson`, called once per render against `recipe.ingredients`' **original, unscaled** quantities and `recipe.servings` — deliberately NOT `displayIngredients`/`portions`/`unitSystem`. Per-person nutrition is portion-count-invariant (scaling every ingredient's mass by `portions/servings` and then dividing the total by the same `portions` cancels out algebraically), so recomputing it against the session-only display state would be both redundant and would launder a display-only unit conversion into a nutrition input — `lib/recipes/nutrition.ts`'s own header explicitly separates unit-conversion from nutrition math, and this keeps that boundary real in the one place that could have blurred it.
- **"When number is unknown show: ?"** (annotation on `3997:15950`, stated to cover all five buttons including Time): `NutritionalDataRow`'s `formatValue` renders `t("nutrition.unknownValue")` ("?") for any `null` input, never a fabricated `0`. **#161 (ADR-0013): macros are no longer all-`?`.** `reference.ingredients`' five nutrient columns are now populated from NEVO-online 2025/9.0 for 2,275 of its 2,328 rows (the per-100g ones); the remaining 53 (`nutrient_basis = 'per_100ml'`, all infant formula) are deliberately read as unknown rather than fed into this per-100g math (ADR-0013 §4). `reference.ingredient_unit_masses` is still empty — no household-measure weights shipped with this import — so only mass-magnitude units (`gram`/`kilogram`/`ounce`/`pound`) yield a real figure; `stuk`/`cup`/`eetlepel` and friends still render `?` until a portion-weight source lands. `?` therefore remains correct, design-specified behaviour for a real subset of ingredients/units, not the universal case part 1's module header anticipated. The four macro dropdowns also now carry the NEVO-mandated attribution line (ADR-0013 §2) — see `NutritionalDataRow.tsx` and `docs/open-questions.md#nutrition-dropdown-content-undesigned`.
- **Servings ("5 pers.")** is the session `portions` state, always a real number (floored at 1 by `PortionStepper`) — never `?`.
- **Five of the six buttons open a dropdown** naming the abbreviated figure's full word (Time/Calorieën/Koolhydraten/Proteïne/Vet — annotations on `3997:15949`–`3997:15953`), reusing `Atom/Dropdown`'s labelless bordered-panel mode with a single line of explanatory text, plus the same click-outside-closes convention `RecipeDetailPage.tsx`'s own overflow menu and `TeDoenHeader.tsx` already use (one shared `openKey`/ref per row — only one popover open at a time). The popover's own content is Figma-specified (the annotation names it); its exact visual (width/padding/position) is not — flagged: `docs/open-questions.md#nutrition-dropdown-content-undesigned`.
- **The sixth (servings) button carries no annotation** (`3997:16065`/`3997:25590`, unlike the five above) — no dropdown/handler is invented for it. Rendered `disabled`, the same "real but non-functional" precedent this page's own "Voeg toe aan mand" button already established for an undrawn/unwired affordance.

### Ingredients Card gains a `settings` slot — the Pas-aan trigger

Figma's `Card` component set gained a `Settings` boolean (V2, fetched instances `3997:25493` mobile / `3998:10755` desktop) rendering an icon-only `Settings2` `Button` in the title row, annotated "Clicking launches #Recept/Mobile/PasAan/Dropdown". Mapped onto `Card`'s new `settings?: ReactNode` prop (`components/molecules/Card.tsx`, `design/notes/Card.md`'s own #160 entry has the full prop/rendering reasoning, including why the title row now renders even without a `title` — the common "no `group_label`" case would otherwise silently drop the trigger).

**Rendered on the first ingredient group's Card only** (`groupIndex === 0`): every fetched instance shows exactly one ingredient Card carrying `Settings=true` (the sample recipe has one group), and Personen/Eenheid apply to the whole recipe, not one group — showing the trigger on every group's Card would duplicate one recipe-wide control across N cards. A reasoned extension of the fetched single-instance sample to the multi-group case, not a literal read (flagged here per the same "extend past what's literally sampled" precedent as `RecipeDetailPage.md`'s own pre-existing "`group_label`-less ingredients" entry).

### Pas-aan panel — `PasAanPanel.tsx`, `SidePanel` reused as-is

`app/(app)/recepten/[recipeId]/PasAanPanel.tsx` (page composition, no `figma-map.json` entry). Wraps the existing `components/organisms/SidePanel.tsx` directly — its pull-up (mobile)/slide-in (desktop) behaviour is already exactly what the fetched nodes show (mobile `3998:10701` "Pull-up panel"; desktop `3999:10877` annotated "Slides in from right"), so no second panel primitive was built, per the ticket's own instruction.

**Personen** (`Card` titled "Ingrediënten", reused directly — Figma wraps both rows in a real `Card` instance, same bordered slot every other `Card` uses) renders `PortionStepper` (#123/#153, unchanged: floor of 1, `min` default 1) rather than the literal fetched node. Deviation, flagged: the fetched "Personen" row (`I3998:10928;3997:25437;3998:11009` mobile / `I3999:11007;3997:25437;3999:11001` desktop) draws a *single* `Button/Default` instance with `Icon/Plus` in both its leading AND trailing icon slots — the same root Figma-authoring pattern `docs/open-questions.md#portion-stepper-figma-draws-plus-twice` already names for `PortionStepper`'s own nodes, just in a different structural shape (one button with two icon slots, not two buttons). Rather than build a second, differently-shaped servings widget for this one panel, `PasAanPanel` reuses the already-built, already-approved `PortionStepper` molecule — functionally identical intent ("adapts the ingredient amounts based on n.o. people", the row's own annotation), same component, one fewer bespoke control in the codebase. Extended that open question with this recurrence rather than opening a new one.

**Eenheid** (annotation: "Clicking launches dropdown with 2 options: Amerikaans / Metrisch") is a `Button` trigger (current system's label + `ChevronDown`) opening a 2-option `Atom/Dropdown`, same selected-highlight convention as `TeDoenHeader.tsx`'s sort menu (`variant="filled"` for the active option, `"white"` otherwise, `aria-pressed`).

**Session-only, both settings — binding, not relitigated.** Neither `portions` nor `unitSystem` is written anywhere: `recipes.servings` is never updated from this page (upholds #128's existing decision, itself restated from #94-era product direction), and the unit preference has no column at all. Both reset on navigation, same as `portions` already did pre-#160.

**Draft state, committed only on "Opslaan" — user decision.** The Figma panel draws two footer buttons, "Verwijderen" and "Opslaan"; **the user decided (2026-08-05): drop "Verwijderen" entirely, keep only "Opslaan", which merely applies the setting for this session and closes the panel.** `PasAanPanel` therefore keeps its own `draftPortions`/`draftUnitSystem` state, reset to the currently-applied `portions`/`unitSystem` props every time the panel opens (a `useEffect` on `open`), and only calls `onApply` (which is what actually updates `RecipeDetailPage`'s state) from the "Opslaan" button's `onClick`. Closing the panel any other way — the `X` button, overlay click, Escape, or (mobile) the drag-to-close gesture, all of which `SidePanel` already wires to `onClose` — discards the draft, since `onApply` was never called. This is the literal reading of "applies... and closes" as two things Opslaan does (implying the setting is NOT already live before Opslaan is pressed), not an invented cancel/confirm model.

### Unit conversion — `lib/recipes/units.ts`'s `convertToUnitSystem`, the ticket's own UI entry point

Resolves `docs/open-questions.md#metric-imperial-conversion-has-no-ui-entry-point` (removed — this ticket IS that entry point, same closure pattern #153 used for `recipe-step-ingredient-tags-no-data-link`).

`convertToUnitSystem(quantity, unit, system)` is **membership-based, not normalising**: it converts a unit only when that unit is *foreign* to `system`, and leaves a unit that already belongs to `system` untouched. Metric membership: `gram`, `kilogram`, `milliliter`, `deciliter`, `liter`, `theelepel`, `eetlepel` (the Dutch measuring spoons are the metric side, matching #120's own factor split from teaspoon/tablespoon). US membership: `ounce`, `pound`, `cup`, `teaspoon`, `tablespoon`, `fluid_ounce`. A foreign unit converts onto one **flagship unit per magnitude** for the target system (via the existing `convert()`) — metric → gram/milliliter (each magnitude's own base unit, factor 1); US → ounce/cup (the two most commonly recognised US customary units). **The flagship-unit choice for a foreign unit is a build decision, not a Figma spec** — the fetched Eenheid annotation names only the two system labels ("Amerikaans"/"Metrisch"), never which specific unit a foreign quantity should land on, and a "best-fit unit per quantity" scheme (e.g. picking tsp vs tbsp vs cup by magnitude) would need genuinely new, ingredient-agnostic selection logic the ticket doesn't ask for and `units.ts`'s own header explicitly scopes out. Flagged in `units.ts` itself, not just here.

**Regression, caught in review (2026-08-06):** the first version of this function normalised onto the flagship unit unconditionally — a recipe entered as "2 eetlepel olijfolie" rendered "30 milliliter olijfolie" even under the default "Metrisch" view, since `eetlepel` was treated the same as any other volume unit rather than as an already-metric one. Fixed by adding the membership check before the flagship conversion ever runs; `tests/recipes-units.test.ts` now locks in that same-system units (`eetlepel`/`theelepel`/`kilogram`/`liter`/`deciliter` under metric, `cup`/`tablespoon`/`pound`/`teaspoon`/`fluid_ounce` under US) come back unchanged, alongside the cross-system conversion cases.

**`count` units (stuk, snufje, scoop, naar_smaak) render as-is regardless of system**, per the ticket's own instruction — `convertToUnitSystem` passes them through unchanged (structurally unconvertible, same reasoning `units.ts`'s file header already gives for why `convert()` itself has no `count` overload).

**Composes with portion scaling in one place**, per the ticket's own instruction: `lib/recipes/scaling.ts`'s `scaleIngredientRow(s)` now takes an optional `unitSystem` and applies `convertToUnitSystem` AFTER `scaleQuantity`, in the same pass — `RecipeDetailPage.tsx`'s `displayIngredients` (renamed from `scaledIngredients`, #128's own variable) is still the one list feeding both the ingredient `Card`s and the per-step `Tag`s, unchanged from #128's own reasoning for why that matters.

**Formatting**: `formatQuantity` (#120) is unchanged and still emits decimals, not fractions — `docs/open-questions.md#fraction-notation-vs-decimal-formatter` stays open/deferred, per the ticket's own instruction not to solve it here. `convertToUnitSystem` rounds a foreign-unit conversion's output to 2 decimals (the same `roundQuantity` `scaleQuantity` already uses) before `formatQuantity` trims trailing zeros for display, so a converted value never shows raw floating-point noise; a same-system unit's original quantity (already 2-decimal-clean from entry/scaling) passes through untouched.

**Default system**: `metric`. Because membership now wins over normalisation, this means a recipe stored in Dutch-metric units (the common case) renders on first load exactly as entered — no conversion-on-load flash, and no rewritten units for a user who never opens the Pas-aan panel.

### Icon additions

`Flame`, `BicepsFlexed`, `Droplet`, `User` (NutritionalData row) and `Settings2` (Pas-aan trigger) — all five verified path-for-path against their fetched Figma vectors via `download_figma_images` + `renderToStaticMarkup`, no false friends found. Full verification: `design/notes/Icon.md`.

### Verification (part 2)

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget`/`test:visual` run — see the PR for exact numbers. **Not run:** a real authenticated `/recepten/[recipeId]` in a browser — this dev machine has no Docker/local Supabase (`CLAUDE.md`), the same standing gap every Phase 3/4 page has hit (`docs/HANDOFF.md`); nothing about the nutrition row's real (non-`?`) rendering, the panel's real save round trip, or the unit conversion's on-screen appearance has been exercised against real seeded data.

## Verification (part 1, #127/#128/#153)

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` run and green (see the PR for exact numbers). **Not run:** a real authenticated `/recepten/[recipeId]` in a browser — this dev machine has no Docker/local Supabase (`CLAUDE.md`), the same standing gap every Phase 3/4 page has hit (`docs/HANDOFF.md`).

## Kitchen units & fraction notation (#164/#157 slice 2, 2026-08-07)

Slice 1 (same PR, `supabase/migrations/20260807000001_usda_unit_masses.sql` + `lib/recipes/mass-resolution.ts`'s `resolveMassWithBridge`) seeded cup/tablespoon/teaspoon masses for solids and a milliliter density row for liquids, and resolved them user-override-then-reference-then-bridge. This slice is the DISPLAY half: a new pure module `lib/recipes/kitchen-units.ts` (house style of `units.ts`/`nutrition.ts`/`mass-resolution.ts` — no Supabase, no next-intl, framework-free, `tests/recipes-kitchen-units.test.ts`) that composes `units.ts`'s ingredient-blind `convert()`/`convertToUnitSystem` with an already-resolved per-ingredient mass — the composition layer ADR-0011 §3 explicitly allows, same relationship `nutrition.ts` already has to `unitMassGrams`.

**Fraction notation (`formatQuantityFraction`)** resolves this file's own `fraction-notation-vs-decimal-formatter` open question (removed from `docs/open-questions.md`, closed here per that entry's own "deferred to its own ticket" note). ASCII slash ladder (eighths/quarters/thirds/halves, no unicode glyphs, no "~"), 0.02 absolute snap tolerance (with a `1e-9` epsilon added purely to absorb binary-floating-point representation noise at the exact tolerance boundary — e.g. `0.27 - 0.25` computes as `0.020000000000000018`, not `0.02`, in IEEE 754 doubles — not a semantic loosening of the 0.02 spec), mass-magnitude quantities always stay decimal (`magnitudeOf`). A sibling of `formatQuantity`, not a replacement — `formatQuantity` itself is unchanged and still used wherever a UnitCode isn't in play (`NutritionalDataRow.tsx`'s kcal/carbs/protein/fat/time/servings figures, none of which are recipe ingredient units).

**Kitchen-friendly unit choice (`convertToKitchenUnit`)** intercepts exactly two of `convertToUnitSystem`'s flagship landings: a mass quantity landing on `ounce` under "us" becomes `cup` (stepping down to `tablespoon`/`teaspoon` via plain unit-blind `convert()` once the cup figure is known, thresholds 1/4 cup and 1 tablespoon, both exclusive) when a `masses.cup` resolves; a foreign volume quantity (`cup`/`teaspoon`/`tablespoon`/`fluid_ounce`) landing on `milliliter` under "metric" becomes `gram` when `masses[unit]` resolves. Detected by comparing the landed flagship unit against the original unit rather than re-deriving `units.ts`'s own private `METRIC_UNITS`/`US_UNITS` sets (unexported by that file's ingredient-blind design) — see the module's own header comment for the full reasoning. `milliliter`/`deciliter`/`liter`/`eetlepel`/`theelepel` are never touched (already metric-native — the "375 ml stays 375 ml, not 386 gram" regression the ticket named).

**Wiring, no second round trip.** `queries.ts`'s `nutritionInputsForIngredients` already batch-fetches every `(ingredient, unit)` mass row (no `.eq("unit", ...)` filter) for #160's nutrition row; a new `kitchenUnitMassesFor` reads more of that same already-fetched map (cup/tablespoon/teaspoon/fluid_ounce, via `resolveMassWithBridge`) instead of a second query. Carried as a new plain-data field `RecipeIngredientWithNutrition.kitchenUnitMasses` (`lib/recipes/types.ts`) — plain data, not a resolver function, because this recipe crosses the `page.tsx` (Server Component) → `RecipeDetailPage.tsx` (`"use client"`) prop boundary, which cannot carry a function. `lib/recipes/scaling.ts`'s `scaleIngredientRow(s)` gained an optional `masses`/`getMasses` parameter, composing scale → `convertToKitchenUnit` in the same one pass #160 already established; omitted, it reproduces the old `convertToUnitSystem`-only behaviour exactly (every pre-existing scaling test still passes unmodified).

**i18n: `recipes.unitsShort`** (`messages/nl.json` + `messages/en.json`, ADR-0007, identical 17-key sets to `recipes.units`) — abbreviated unit labels ("g", "ml", "tbs", "el", "tl", "fl oz", ...) matching the literal Figma Tag text this file's own "Step ingredient tags" entry already quotes ("2 tbs Chia Seeds", "375 ml Non Dairy Milk"). Used ONLY at the per-step Tag call site — the ingredient-card `CardContentIngredient` Tag keeps the long `recipes.units` label, per `formatQuantity`'s own doc comment citing that Tag's long-form examples ("1250 Gram", "2 Scoops"). The four count units with no real abbreviation (stuk/snufje/scoop/naar_smaak) reuse their long-form word lowercased rather than inventing a shortened form Figma never draws.

Verification: `pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget`/`test:visual` all run — see the PR for exact numbers. Same standing gap as every part above: no real authenticated `/recepten/[recipeId]` browser check (no Docker/local Supabase on this dev machine).

## #166 (2026-08-08) — Recept page feedback round

Figma MCP was down this session; every node fetched via the REST API directly (`.mcp.json`'s key), per `docs/guides/ui-components.md`'s documented fallback. **Two of the ticket's linked node ids no longer exist in the file**: `4003:5441` ("Button is anders in design") and `4003:5508` (the ingredient-card underline node) both resolve to `null` on `GET .../nodes?ids=...` — confirmed with and without a `depth` param, and again by grepping a full depth-6 dump of the whole "Development" page for either id, finding neither. The file's `lastModified` is the same day as this ticket, so a designer edit after the ticket was filed most likely deleted/replaced whatever those ids pointed at. Not guessed around:

- **Button (item 2)**: `Atom/Button`'s own component set (`3623:4346`, the one `figma-map.json` maps) was re-fetched anyway and is structurally unchanged from #112's last verified round — same 40 variant node ids, same `componentPropertyDefinitions`. No corresponding live discrepancy found by comparing current call sites against that set. **Flagged, not fixed** — the specific complaint behind the deleted node is unrecoverable this session; needs either a fresh Figma link from the reporter or a screenshot of the actual mismatch.
- **CardContentIngredient underline (item 7)**: fixed anyway, from the bug report's own words plus the still-live `3727:4021` set — see `design/notes/CardContentIngredient.md`'s own #166 entry for the mechanism (a lone `border-bottom` on a `rounded-3xl` box curves at the corners; moved to an unrounded sibling div).

**Incidental discovery, round 1 — partially resolved by round 2.** Re-fetching `Recept/Mobile/PasAan/Dropdown` (`3998:10701`) for round 1's item 4 research found the "Pas aan" panel restructured since #160 into two `Card-content/Ingredient`-style rows. Round 1 flagged this as out of scope and left it untouched. Round 2's own item 1 fetch (desktop equivalent, `3999:11007`) confirms `PasAanPanel.tsx`'s row shell was already an exact match for that structure all along — same `Card-content/Ingredient` row template (`padding: 12px`, `gap: 20px` → this file's `py-3 pl-3 pr-3 gap-5`, matching on both the Personen and Eenheid rows), same divider line between them (`border-b border-border-muted`, already present). The ONLY real deviation was the Personen control itself — a bordered-box `PortionStepper` where Figma now draws a single filled `Button` pill — which round 2 fixes (`design/notes/PortionStepper.md`'s round-2 entry). Eenheid's own `Button trailingIcon="ChevronDown"` already matched the fetched node's Button instance exactly (`Leading icon: false, Trekking icon: true`) and needed no change. Nothing about `PasAanPanel.tsx`'s row/Card shell changed — the "whole panel redesigned" reading from round 1 overstated the gap; only one control inside it was actually wrong.

**Fibre (item 3), rounding (item 6), default ingredients title (item 5), delete buttons (items 1/8), Input-field state parity (item 4)** — each has its own entry in the relevant component's note (`NutritionalDataRow`'s reasoning stays here since it has no separate note file: fibre reuses the exact same `isNevoData`/dropdown/`formatValue` machinery the other four macros already have, `icon="LeafyGreen"` per the fetched `4025:11826` instance's `Icon/Leafy-green`, label "Vezels" per that node's own annotation; rounding is a new `formatMacro` wrapper — `Math.round` before `formatQuantity`, display-layer only, `lib/recipes/nutrition.ts`'s stored/summed values stay full precision, `null` still short-circuits to "?" before rounding is ever attempted); `RecipeIngredientRow.md`, `CardContentIngredient.md`, `ImageUploadField.md`, `PortionStepper.md` carry the rest. Gates run this ticket: see the PR for exact numbers.

## #179 part 2 (2026-08-09) — AddToBasket animation + per-ingredient swipe-to-cart

Header `ShoppingBasket` `Button` swapped for `AnimatedAddToBasketButton` (labelled: `label`/`addedLabel`, node `4051:12888`) — same `handleSendToList` handler, no behaviour change beyond the click→"Toegevoegd" slide + press-scale. Full mechanism, annotations and judgement calls: `design/notes/AnimatedAddToBasketButton.md`.

**Ingredient rows gain `swipeAction="cart"`** (`CardContentIngredient`'s generalised swipe gesture, `design/notes/CardContentIngredient.md`'s own #179 entry) — swiping a row reveals an icon-only `AnimatedAddToBasketButton` that adds *that one ingredient* to the shopping list, scaled to the page's current session `portions` (same display-only rule #128/#160 already established, never `recipe.servings`). New handler `handleAddIngredientToCart(ingredientId)` calls `addIngredientToShoppingList` (`app/(app)/winkelmand/actions.ts`, #179 part 2) — fire-and-forget, same shape as `handleSendToList`, no success/failure UI (see `AnimatedAddToBasketButton.md`'s judgement call #2 for why that's a deliberate, not overlooked, decision).

**Accessible label is per-item, not generic** — `addIngredientToBasketLabel` ("Voeg {name} toe aan mand"/"Add {name} to basket") interpolates the ingredient's own name, same reasoning `WinkelmandPage.md`'s own "`deleteLabel` — per-row, not the generic ingredient string" entry already gives for that page's delete button: a screen-reader user tabbing to the now-keyboard-reachable (#177 mechanism, reused unchanged) revealed button hears which ingredient it adds. `components.cardContentIngredient.addToCartLabel` stays the generic, non-interpolated string for `AnimatedAddToBasketButton`'s own Ladle stories, mirroring `deleteLabel`'s own generic/per-row split.

**The single-add server action, not a second copy of the send logic.** `addIngredientToShoppingList` loads the recipe via the same ownership-checked `getRecipeWithIngredientsAndSteps` `sendRecipeToShoppingList` already uses, finds the target row in the already-loaded `recipe.ingredients` (no second query), and scales+merges via `lib/shopping/send-to-list.ts`'s new `mergeSingleIngredientLine` (extends the existing `buildShoppingListLines`/`scaleIngredientRows`/merge-rule machinery rather than reimplementing it — see that module's own header). Unlike the bulk send, this path also merges into an **existing** `shopping_list_items` row (same name+unit) rather than always inserting, since adding one ingredient from two different recipes on two different visits must still sum onto one line. Covered by new tests in `tests/shopping-send-to-list.test.ts`.

No visual baseline change from the header button swap alone would be expected, but `AnimatedAddToBasketButton`'s own composite content does change the DOM inside the button — `card-content-ingredient--swipe-to-cart` is a genuinely new baseline (see `CardContentIngredient.md`); `RecipeDetailPage.tsx` itself carries no Ladle story (unchanged reasoning, see "Ladle — no new story" above), so nothing here needed a baseline regeneration of its own.

### Verification (part 2 of #179)

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` all run clean; `pnpm test:visual` run twice full-suite (per the workflow's own flake-handling instruction) — 1 pre-existing, already-documented flaky story failed each run (`category-panel--create-category` run 1, `category-panel--edit-category` run 2 — both in the known rasterization-noise set, neither touched by this ticket), nothing else. New baselines: `animated-add-to-basket-button--{labelled,icon-only,nl-catalog,disabled}`, `card-content-ingredient--swipe-to-cart`.

**This ticket broke the standing "no Docker, no live browser" gap the same way #179 part 1 already did** (`WinkelmandPage.md`'s own #179 entry) — a throwaway test user + recipe (two ingredients, `Bloem`/`Melk`) was created via the Supabase Admin API against the real hosted project (service_role, a local Node script — never committed, same "admin task, not a runtime path" category as `scripts/import-nevo.ts`), driven through a real login and `/recepten/[recipeId]` with Playwright at both 1440px and 390px viewports, then fully deleted afterward (test user + recipe + ingredients + shopping-list rows; confirmed via `auth.admin.getUserById` returning "User not found" post-cleanup).

**Confirmed working, live:**
- Header button: clicking swaps the Basket/label face for the Check/"Toegevoegd" face (`aria-hidden` flips correctly on both faces) and reverts on its own — measured at the then-current 1.5s timer, raised to 2s afterwards on user request, not re-verified live.
- Swipe-revealed cart button: renders the `filled` variant with the basket icon (light grey fill, not the destructive red the delete branch uses) — confirmed both by reading `backgroundColor` and by screenshot.
- Desktop hover does **not** move the row: dispatched a `pointermove`-only sequence (no `pointerdown`) across the full row width and read the content row's `transform` before/after — identical, confirming the #179 part 1 `dragging`-ref fix still holds after this ticket's `swipeAction` generalisation.
- A **real** mouse-driven drag (Playwright's CDP-level `page.mouse.down/move/up`, not a page-context synthetic `PointerEvent`) opens the row and reveals the cart button, which is then clickable.
- The keyboard-focus reveal path (#177) works identically for `swipeAction="cart"`: focusing the revealed button sets `open` and slides the row to `-48px`, same as the delete branch.
- `prefers-reduced-motion` (real `page.emulateMedia({ reducedMotion: "reduce" })`, not a CSS class toggle): `getComputedStyle(...).transitionProperty` reads `"none"` on both `Face` spans and on the `Button` root itself, confirming `motion-reduce:transition-none!`/`motion-reduce:active:scale-100` actually win under a real media-query match, not just present as unverified classes.
- The single-ingredient add's **merge/update path** end-to-end against the real database: pre-seeded an existing "Bloem"/"gram" `shopping_list_items` row (250g) via the admin client, clicked the revealed cart button, and confirmed the *same row* updated to 500g (not a duplicate insert) — `mergeSingleIngredientLine`'s "update" branch, `addIngredientToShoppingList`'s corresponding `.update()` call, and the client-side click handler all wired correctly.

**Confirmed, but hitting a known pre-existing gap, not a bug introduced here:** the single-ingredient add's **insert** path (a brand-new line, no existing match) failed live with `PGRST204 Could not find the 'reference_ingredient_id' column of 'shopping_list_items' in the schema cache` — the same standing gap `WinkelmandPage.md`'s own #179 entry already documented for `sendRecipeToShoppingList`'s insert path: the migration adding that column hadn't reached the hosted project (ADR-0012 — only the user-run `deploy.yml` workflow applies it, and that ticket was explicitly forbidden from applying it by hand). The code itself was correct all along (`mergeSingleIngredientLine`'s "insert" branch, unit-tested in `tests/shopping-send-to-list.test.ts`); only the hosted schema was stale.

**Resolved 2026-08-09.** The user reported both add-to-basket paths leaving the Winkelmand empty, which is this same gap seen from the UI: *every* insert failed (bulk send and single add alike), while the optimistic "Toegevoegd" animation hid the failed `ActionResult` — see `AnimatedAddToBasketButton.md` judgement call #2, which is exactly the cost that call was accepting. `20260809000001_shopping_list_items_reference_ingredient.sql` was applied by hand to the hosted project with the user's explicit approval (ADR-0012 §5 confirm-then-apply). Two follow-ups that this path always needs: `supabase_migrations.schema_migrations.version` came back as the apply-route's own timestamp and was corrected by hand to `20260809000001` so `supabase db push` still reconciles, and `notify pgrst, 'reload schema'` was issued so PostgREST stopped serving the stale cache the PGRST204 came from.

**Not verified: real touch input.** Playwright's page-context synthetic `PointerEvent` dispatch (used for the hover-not-moving check above, where no capture is needed) throws `NotFoundError: Failed to execute 'setPointerCapture'` when used to simulate a `pointerType: "touch"` drag — a tooling limitation (synthetic events don't register an "active pointer" the browser will let you capture), not a product bug. The gesture code itself is unchanged from #160/#177/#179 part 1 (Pointer Events unify mouse/touch — no separate touch-only code path exists to diverge), and that code's touch behaviour was already verified with real touch-drag emulation in those earlier tickets (see `WinkelmandPage.md`'s own #179 verification section). This ticket's real, CDP-level mouse-drag test above exercises the identical `handlePointerDown`/`handlePointerMove`/`handlePointerEnd` handlers a touch drag would.

## Hero thumbnail delivery (#171/#174, chunk 2) — moved to `design/notes/CardContentRecipe.md`

The hero `<img>` now points at `/api/recipe-thumbnail/<recipeId>?size=full&v=<recipe.updated_at>` (LCP element: `loading="eager"`, `fetchPriority="high"`, explicit `1280×640`) instead of a server-resolved signed URL — `page.tsx` no longer calls `getRecipeThumbnailSignedUrl` for it. Full reasoning (two WebP variants, why not `next/image`, the route's cache headers, and — chunk 3 — why the singular signed-URL helper turned out not to be needed and was deleted) lives in `design/notes/CardContentRecipe.md`'s "Thumbnail delivery" section — one home for a fact shared with `ReceptenBoard.tsx`'s card thumbnails, not duplicated here.

## TICKET #205 (2026-08-12): page-padding token

Root wrapper: `pr-4 md:pr-32`→`pr-page-right-equal`. No node lookup needed,
per the ticket's own page-padding rule.

## #219 (2026-08-12): radius/spacing token migration

Measured via the `figma-console` bridge (`figma.getNodeByIdAsync` +
`boundVariables`, never inferred from a resolved value) against
`Recept/Mobile` (`3997:14737`) and `Recept/Desktop` (`3997:15171`).

### Converted

| Line | Old | New | Node(s) | `boundVariables` key | Figma variable |
|---|---|---|---|---|---|
| 206 | `gap-6` (outer wrapper) | `gap-page-stack` | `3997:14738`/`3997:15173` ("Main") | `itemSpacing` | `spacing/layout/page-stack` |
| 252 | `gap-5` (Bewerken/Verwijderen) | `gap-inline-xl` | `3997:14742`/`3997:15176` ("Knoppen") | `itemSpacing` | `spacing/inline/gap-xl` |
| 331 | `py-4` (Title frame) | `py-component-lg` | `3997:15946`/`3997:15181` ("Title") | `paddingTop`/`paddingBottom` | `spacing/component/padding-lg` |
| 381 | `gap-6` (Steps wrapper) | `gap-page-stack` | `3997:14738`/`3997:15173` ("Main", Step Cards are its direct children) | `itemSpacing` | `spacing/layout/page-stack` |

### Flagged

- **Header row `gap-4`** (line 208, back-arrow + right actions): Header
  (`3997:14740`/`3997:15174`) has `itemSpacing: 16` but an **empty**
  `boundVariables` — `primaryAxisAlignItems: SPACE_BETWEEN`, so Figma never
  binds a spacing token here (the layout computes gaps automatically). The
  raw value is a leftover, not a design token. Left as `gap-4`.
- **Delete-confirm row `gap-4`/`gap-2`** (lines 217/220): no Figma node
  models the "Weet je het zeker?" confirm state at all — searched both
  `Recept/Mobile` and `Recept/Desktop` for the confirm/cancel copy
  (`Weet je het zeker`, `Annuleren`, `Ja, verwijderen`), zero matches. Same
  precedent as the delete-confirm UI itself (no Figma source, `#94`
  pattern).
- **"Voeg toe aan mand" + Bewerken/Verwijderen outer `gap-4`** (line 240):
  real discrepancy, not a plain gap. Desktop's flat "Knoppen" row
  (`3997:15176`) spaces **all three** buttons (`Voeg toe aan mand`,
  `Bewerken`, `Verwijderen`) uniformly at `itemSpacing: 20`
  (`spacing/inline/gap-xl`). The code nests these as
  `AnimatedAddToBasketButton` + a separate `[Bewerken, Verwijderen]` group,
  giving an outer gap of 16 and an inner gap of 20 — Figma wants 20
  everywhere. Converting the outer gap to `gap-inline-xl` would change the
  rendered gap from 16px to 20px, which the pixel-identical rule forbids.
  Flagged instead of "fixed." Worth a design call: either the nesting
  should go away (flatten to one row, one gap) or Figma should show the
  16/20 split explicitly.
- **Mobile Ellipsis overflow `mt-2`** (line 273): the overflow menu itself
  is an undesigned node (pre-existing comment, `#94`/`TeDoenHeader.tsx`
  precedent) — no Figma node, so no binding to measure.
- **Thumbnail/placeholder `rounded-xl`** (lines 326, 330): "image 63"
  (`3997:14745`/`3997:15180`, a plain `RECTANGLE`) has `cornerRadius: 12`
  on all four corners but an **empty** `boundVariables` — unbound in
  Figma, despite 12px exactly matching `radius/card`. This is precisely
  the "don't infer from the value" trap the ticket calls out — not
  converted.
- **Title-frame `gap-6`** (line 331, h1-to-NutritionalDataRow gap):
  `3997:15946`/`3997:15181` ("Title") has `itemSpacing: 24` but its
  `boundVariables` only carries `paddingTop`/`paddingBottom` — `itemSpacing`
  itself is unbound (confirmed via a direct raw `boundVariables` read, not
  just the filtered walk), despite 24px matching both `stack/xl` and
  `page-stack`. Left as `gap-6`.
- **Ingredient-cards row `gap-6 md:flex-row`** (line 348): the fetched
  design only ever shows **one** ingredient-group `Card` per breakpoint
  (`Settings#3997:5: true` appears on exactly one Card instance in both
  `Recept/Mobile` and `Recept/Desktop`) — Figma keeps all Cards as flat
  vertical siblings of "Main," governed by `page-stack` (24px), and never
  designs a side-by-side desktop row for multiple groups. This is the
  axis-rule case the briefing calls out by name: a stack-family value
  (24, which has no `inline/*` equivalent — that scale tops out at 20)
  reused as a row-axis gap on `md:flex-row` with no Figma-confirmed
  binding for that specific relationship. Flagged rather than silently
  applying `gap-stack-xl`/`gap-page-stack` to the row case.

### Structural note (not a spacing issue, no action taken)

`Main` (`3997:14738`) has both a bare top-level `Button/Default`
(`3997:14739`, the back arrow, `x:16,y:16`) **and** a `Header` frame
(`3997:14740`) that separately contains its own `Button/Default`
(`3997:14741`) + `Knoppen`. This looks like a leftover/duplicate layer in
the Figma file rather than a real second header — didn't change any
conversion above (the values used come from `Header`/`Knoppen`, which is
what's actually visible), but worth a design-file cleanup pass someday.

## 2026-08-18 — mobile Ellipsis overflow menu moved onto the shared popover positioner

One of the seven call sites of the shared `lib/dom/use-popover-position.ts`
positioner — not one of the two reported off-screen bugs itself, converted
alongside them since it's the same hand-rolled pattern. `top-full right-0
mt-2` → the hook, `anchor="right"`, `prefer="below"` (unchanged designed
placement — this popover always had room below on the pages it appears on).
Full mechanism: `docs/incidents.md` (2026-08-18).

## Import additions (#318)

- "Bron" source link (`SourceLink.tsx`, Claude-designed on request): `text-base font-semibold text-text-secondary` line under the nutrition row, host as plain text, `target="_blank" rel="noopener noreferrer"`, shown only for a stored https URL. Story `SourceLink`.
- Ingredient rows with `needs_review` get the "controleren" marker (see `CardContentIngredient.md`).
