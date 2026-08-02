# RecipeDetailPage (`/recepten/[recipeId]`)

- **Code:** `app/(app)/recepten/[recipeId]/page.tsx` (Server Component: fetch + `notFound()`), `RecipeDetailPage.tsx` (`"use client"`, page-level composition — same non-mapped-component precedent as `ReceptenBoard.tsx`/`RecipePanel.tsx`, not added to `design/figma-map.json`).
- **Node IDs:** `3778:5427` (Mobile, 402px), `3778:5584` (Desktop, 1440px), `3953:9750`/`3778:5596` (portion row, already `design/notes/PortionStepper.md`'s), `3778:5437`/`3778:5600` (ingredient cards), `3778:5459`/`3778:5622` + `3778:5467`/`3778:5630` (step cards).

Built #127. Fetched all nodes live via `mcp__figma__get_figma_data` before writing any UI.

## Shell reuse — no new header/sidebar chrome

`AppShellNav.tsx` (#88/#101) already renders the persistent desktop `Sidebar` (collapsed rail) and the mobile floating `Icon/Panel-left-open` button (`3778:5429`'s own node) around every `(app)` route, and `main`'s own padding (`pt-4 pb-20 pl-4 md:pt-20 md:pb-20 md:pl-32`) already matches this page's own Figma "Main" padding on three of four sides. This page only adds the missing `pr-4 md:pr-32` half (same values `PageHeader.tsx` already applies for the same reason) on its own root wrapper — nothing here duplicates the shell.

## No `PageHeader` — literal structural read

Figma's header row (`3778:5430`/`3778:5587`) has no `<h1>` slot at all (back-arrow left, a buttons row right); the recipe title renders separately, centered, below the hero image. Reusing `PageHeader` (title-left/actions-right) would have imposed a shape this screen doesn't have. Built as a plain `flex justify-between` row instead.

## "Voeg toe aan mand" — rendered, disabled

Binding user decision (2026-07-29): rendered at both breakpoints, `disabled`, no click handler. `#29` (Phase 5) wires it; Phase 4 builds no `shopping_list_items` and no write path. Flagged in the PR so a reviewer doesn't read the empty handler as an omission.

## No duration/time, no category tags — deliberate, not an omission

Neither `Icon/Timer`+minutes nor a category `Tag` row appears anywhere in either fetched node, even though `recipes.duration`/`recipe_categories` both exist in the schema and the overview card (`CardContentRecipe`) renders duration. Not built here — a Figma-recorded scope boundary per the ticket, not a gap.

## Mobile Ellipsis overflow menu — undesigned, least-inventive fill

`3778:5434` is an icon-only `Icon/Ellipsis` `Button` with no annotation and no panel anywhere in the file (unlike desktop's two real, separately-styled `Button` instances). Built as `TeDoenHeader.tsx`'s own board-switcher/sort menu pattern: an icon-only trigger owning a local `overflowOpen` boolean, `aria-expanded`, a `pointerdown`-outside-closes effect (copied inline here, same shape as `TeDoenHeader.tsx`'s `useCloseOnOutsidePointerDown` — not extracted to a shared hook for one extra call site), and an absolutely-positioned `Atom/Dropdown` in its labelless "static bordered panel of `Button` rows" mode holding "Bewerken" (`variant="white"`)/"Verwijderen" (`variant="destructive"`). No new menu component — reuses `Button`+`Dropdown` exactly as `TeDoenHeader.tsx` already does. Flagged: `docs/open-questions.md#recipe-detail-mobile-overflow-menu-undesigned`.

## Delete confirmation — #94 precedent, moved from panel footer to page header

No confirmation dialog is modelled anywhere in Figma for either "Verwijderen." Follows `CardDetailPanel.tsx`'s #94 precedent (two-step: click Verwijderen swaps to "Weet je het zeker?" + Annuleren/Ja-verwijderen, no `window.confirm`, no second dialog) — adapted from a `SidePanel` footer to this page's own header row, since there is no panel/footer context here. The confirm row uses `flex-wrap` rather than a hard mobile/desktop branch, so it reflows under real content rather than needing a second layout path. Both the desktop header's standalone Verwijderen button and the mobile overflow menu's Verwijderen row set the same `deleteConfirming` state — one confirm UI, two triggers.

`handleDelete` calls `deleteRecipe` directly and, on success, `router.push("/recepten")` (the just-deleted recipe's own route can no longer resolve). On failure, the error renders inline below the header via `recipes.errors.*`, matching every other action call site in this codebase.

## `group_label`-less ingredients — no group heading, not a default label

Ingredients with a `null` `group_label` render inside one shared, **untitled** `Card` (no "Overig"/"Other" label invented) rather than being hidden or scattered. Reasoning: `Card`'s own `title` prop is already optional/boolean-gated in Figma (`Title` bool + `Text`) — omitting it for a group with no name is the literal behaviour the atom already models, not a new state. Inventing a default label string would be UI content Figma never draws for this component. Groups render in first-seen order (by `position`); a `group_label` value that recurs non-contiguously merges into its first occurrence's bucket rather than opening a second card with the same title — an edge case with no real-world likelihood (a user re-using "Wet" twice non-adjacently) rather than a designed behaviour.

## Ingredient row divider — measured, not invented

Every fetched `Card-content/Ingredient` instance under both `Ingredients` nodes carries the same `strokeWeight: 0px 0px 1px` / `#E7E5E4` bottom rule `CardContentIngredient.md`'s `#131` entry already named `divider` for — including the last row in each card, no last-child exception. Passed `divider` on every row rendered here, matching the fetched reality rather than the ticket prose alone.

## Step ingredient tags — real, shipped #153, closes the #127 gap

#127 shipped `withIngredientTags={false}` on every step because `recipe_steps` carried no FK/join to `recipe_ingredients` at the time. #149 added `recipe_step_ingredients` and `getRecipeWithIngredientsAndSteps` now returns each step as `RecipeStepWithIngredients` (`ingredientIds: string[]`, ordered by the link's own `position`) — only this page's render call was stale, not the schema. `docs/open-questions.md#recipe-step-ingredient-tags-no-data-link` is resolved/removed by this ticket.

Both fetched nodes' step-2 (`3778:5467`/`3778:5630`) draw each `Slot`'s `Tag` instances as a single combined string — `"2 tbs Chia Seeds"`, `"1 Banana"`, `"375 ml Non Dairy Milk"` — i.e. **quantity+unit+name in one Tag**, not name alone. Built to match: `${formatQuantity(quantity, tUnits(unit))} ${name}`.trim-equivalent (quantity-less ingredients — `formatQuantity` returns `""` — fall back to name only, so no leading space/orphan number). Both nodes' Tag instances resolve to `Color=Grey` (`fill_aa157800` `#F5F5F4` bg / `fill_974f0cf9` `#79716B` text) — exactly `Tag`'s existing `neutral` variant (`bg-surface-muted`/`text-text-muted`), no gap.

`ingredientIds` are looked up in `recipe.ingredients` (a step never carries a second copy — `RecipeStepWithIngredients`'s own doc comment already mandates this), via a `Map` built once per render; an id with no matching row (shouldn't happen, FK-enforced) is silently dropped rather than crashing. A step with an empty resulting list renders `withIngredientTags={false}` (no empty tag strip), matching every other step in both fetched nodes that has the boolean `false` (e.g. step 1, `3778:5459`/`3778:5622`).

Order preserved as returned (the join's own `position`), matching the "ordered by the link's own position" comment on `RecipeStepWithIngredients` — not re-sorted or deduplicated against the ingredient list's own `position`.

## Portion stepper — display-only local state, floor of 1 since #153

`PortionStepper` (#123) is rendered with `recipes.servings` as its initial value and a plain `useState`/`onChange` pair that only updates the on-screen count — no ingredient quantity is recalculated. Live rescaling (`scaleQuantity`, #120) is #128's scope, not this ticket's; wiring the same `onChange` seam to it is the documented follow-up (`PortionStepper.md`). `page.tsx` keys `RecipeDetailPage` on `recipe.id`, so this (and every other piece of local state) resets deterministically if a future ticket ever links one recipe detail page directly to another's — no in-app UI does that today.

#153 (2026-08-02, user feedback: "Personen teller kan op dit moment naar -x personen") added the floor: `PortionStepper` itself now clamps/disables at its own `min` prop (default `1`), so this page needed no change to enforce it — see `design/notes/PortionStepper.md` for why the clamp lives in the atom rather than in this page's `onChange`.

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

## Verification

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` run and green (see the PR for exact numbers). **Not run:** a real authenticated `/recepten/[recipeId]` in a browser — this dev machine has no Docker/local Supabase (`CLAUDE.md`), the same standing gap every Phase 3/4 page has hit (`docs/HANDOFF.md`).
