# StepIngredientPanel

- **Code:** `components/organisms/StepIngredientPanel.tsx` (+ `.stories.tsx`)
- **Node IDs:** `3749:3091` ("Add recipi/ingredient/Mobile"), panel `3749:3241`.

Built #149, closing the `step-ingredient-pill-panel-undesigned` open question (removed from `docs/open-questions.md`) — #126 left the step field's "+ Ingrediënt" pill `disabled` because this panel had no Figma source at the time; it does now.

## Structure read from the fetched node

A full-screen `Overlay` rectangle (`rgba(12,10,9,0.6)`, `0,0`, `402×874` — the same size as the whole artboard) sits **under** the second "Pull-up panel" (`3749:3241`) and **over** everything else, including whatever panel opened this one. That is the literal reading behind `SidePanel`'s new `level` prop (`design/notes/SidePanel.md`'s #149 entry) — without it, two same-`z-40`/`z-50` panels would only stack correctly by DOM paint order, and this node explicitly draws the second scrim covering the first panel too, not just the page.

Below the handle+X strip: a `Card` whose children are `Card-content/Ingredient` instances — name, a grey `Tag` reading quantity+unit ("1250 Gram", "2 Scoops", "1 Stuk"), an unchecked `Checkbox` — and a footer with one "Opslaan" button (`Save` icon). **No search field, no visible title** anywhere in the node.

## Why it never touches Supabase

The recipe this panel's ingredients belong to may not be saved yet (create mode) — `recipe_ingredients` rows, and therefore real `id`s to link a `recipe_step_ingredients` row against, might not exist. So this panel selects from `RecipePanel`'s own **local** ingredient-row state (`localId`, never a database id) and hands the selection back via `onSave(selectedIds: string[])` — `RecipePanel` is the one that later translates those `localId`s into `ingredientRefs` (payload-array indexes) at save time (`app/(app)/recepten/RecipePanel.tsx`'s own header comment has the full translation). Same "props in, callback out" shape `IngredientSearchPanel` already uses for `onSearch`/`onCreateOwnIngredient` (ADR-0011 §2) — this file never imports a `"use server"` module, so it stays Ladle-testable with no Next.js request context.

## No title, no visible title text

Same reasoning as every other `SidePanel` caller: `title` is required for `aria-labelledby` but rendered `sr-only`, since the fetched node has no heading layer. `components.stepIngredientPanel.title` exists only for screen readers.

## Empty-name rows filtered

`RecipePanel`'s ingredient rows can be blank (a freshly appended row before the user types a name) — those never render here (`ingredients.filter((i) => i.name.trim() !== "")`), matching the same filter `RecipePanel`'s own save payload applies before building `ingredientRefs`. An ingredient typed after this panel was already open for a given step is picked up the next time it's opened (the list is a plain prop, re-derived from `RecipePanel`'s live state on every render).

## Reset-on-open, not remount

Same #103/#105 pattern `RecipePanel.tsx`/`CardDetailPanel.tsx` use: the panel keeps one persistent DOM node and only re-seeds its internal `selected` set from `selectedIds` when `open` flips `false → true`, so the open/close CSS transition always has a previously-painted frame to interpolate from.

## `divider` on every row, no last-child exception

Same precedent `IngredientSearchPanel.tsx` already established for `CardContentIngredient`'s `divider` prop (see that component's own doc comment) — applied unconditionally, matching the fetched node rather than guessing a "no divider after the last row" convention it doesn't draw.

## Ladle stories

`Empty` (no pre-selection), `WithSelection` (two of three real rows pre-checked), `Interactive` (stateful, exercises checkbox toggling + `onSave`'s payload via `console.log`). All three sample lists include one empty-name row to make the filter visible in the story fixture, not just asserted in code. Wrapped in `<div className="min-h-screen">` — `SidePanel.stories.tsx`'s own known trap (a bare static `SidePanel` story crops to a 1280x64 sliver).
