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

## Step ingredient tags — not rendered, no data link exists

The ticket's own sample content shows step 2 carrying four ingredient `Tag`s built with the same formatter as the ingredient rows. `recipe_steps` (`lib/recipes/queries.ts`'s own select list) carries no FK or join table to `recipe_ingredients` at all — the same gap `design/notes/RecipePanel.md`'s "Ingrediënt-pill in the step field" section already names on the write side (that pill is `disabled`, deferred to #149). Rendered every `CardContentStep` with `withIngredientTags={false}` rather than inventing an association. Flagged: `docs/open-questions.md#recipe-step-ingredient-tags-no-data-link`.

## Portion stepper — display-only local state

`PortionStepper` (#123) is rendered with `recipes.servings` as its initial value and a plain `useState`/`onChange` pair that only updates the on-screen count — no ingredient quantity is recalculated. Live rescaling (`scaleQuantity`, #120) is #128's scope, not this ticket's; wiring the same `onChange` seam to it is the documented follow-up (`PortionStepper.md`). `page.tsx` keys `RecipeDetailPage` on `recipe.id`, so this (and every other piece of local state) resets deterministically if a future ticket ever links one recipe detail page directly to another's — no in-app UI does that today.

## Hero image — placeholder only, thumbnail path not resolved

Same treatment `CardContentRecipe.md`/`ReceptenBoard.md` already document for the overview cards: `recipes.thumbnail_path` is never consulted here, only a `bg-surface-muted` box at the fetched heights (146.4px mobile, 440px desktop, `rounded-xl` for the fetched 12px radius). Resolving a real signed URL is a follow-up once a caller actually writes a `thumbnail_path` (still nobody does, per `docs/HANDOFF.md`).

## "Bewerken" — reuses `RecipePanel` in `edit` mode, closes an open question

Opens the same `app/(app)/recepten/RecipePanel.tsx` (#126) `SidePanel` this app already ships, in `{ mode: "edit", recipe }` — the exact shape its `Filled` Ladle story already exercised. Closes the `recipe-edit-trigger-no-host-yet` open question, which this ticket removed from `docs/open-questions.md` (`design/notes/RecipePanel.md` updated to match). `categories` is fetched via the same `getRecipeCategoriesWithRecipes()` `ReceptenBoard.tsx` already calls (heavier than strictly needed — it nests each category's `recipes` — but avoids adding a second, near-duplicate category query for one caller).

**Known redundancy, not a bug:** `RecipePanel`'s own edit-mode footer still renders its own "Verwijderen" (unchanged, #126 behaviour) — opening "Bewerken" surfaces a second delete affordance alongside this page's own header Verwijderen. Both ultimately call the same `deleteRecipe` action; this page's `onDeleteRecipe` prop wraps it with the same `router.push("/recepten")` redirect on success (rather than `RecipePanel`'s normal `onMutated={() => router.refresh()}`, which would `router.refresh()` a route whose recipe no longer exists) — so both entry points behave identically on delete.

## `notFound()` — first real use in this codebase

No prior route needed it. `getRecipeWithIngredientsAndSteps` already returns `null` for "doesn't exist," "not this user's" (RLS) and "signed out" alike (its own doc comment) — `page.tsx` calls Next.js's standard `notFound()` for all three, the plain framework idiom rather than a bespoke empty state, since no ticket or precedent asked for anything else.

## Ladle — no new story, motivated

This file composes only existing, already-storied atoms/molecules (`Card`, `CardContentIngredient`, `CardContentStep`, `Button`, `Dropdown`, `PortionStepper`) with no extracted reusable unit of its own (the ingredient-group and step cards are inline JSX, not a new component). Same shape as `ReceptenBoard.tsx` — a full route body, not a self-contained overlay like `RecipePanel.tsx`/`CardDetailPanel.tsx`/`CategoryPanel.tsx` (which get stories precisely because they render standalone inside a `SidePanel`) — so, following that same precedent, no story was added here.

## Verification

`pnpm lint`/`typecheck`/`test`/`build`/`check:server-only`/`check:comment-budget` run and green (see the PR for exact numbers). **Not run:** a real authenticated `/recepten/[recipeId]` in a browser — this dev machine has no Docker/local Supabase (`CLAUDE.md`), the same standing gap every Phase 3/4 page has hit (`docs/HANDOFF.md`).
