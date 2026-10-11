# StepIngredientPanel
Figma: `Add recipi/ingredient/Mobile` · node `3749:3091`, panel `3749:3241` · Code: `components/organisms/StepIngredientPanel.tsx`

## Anatomy
`SidePanel` (`level={2}`) holding a `Card` of `CardContentIngredient` rows (name, quantity+unit Tag, Checkbox), footer with one "Opslaan" button (`Save` icon). The node has no search field and no visible title. Opened by a step's "+ Ingrediënt" pill in `RecipePanel`.

## Deliberate decisions
- Never touches Supabase. The recipe may be unsaved (create mode), so no `recipe_ingredients` ids exist yet. The panel selects from `RecipePanel`'s local ingredient-row state (`localId`, never a database id) and returns `onSave(selectedIds: string[])`. `RecipePanel` translates localIds into `ingredientRefs` (payload array indexes) at save time (ADR-0029/0030). It imports no `"use server"` module, so it stays Ladle-testable. (#149)
- `level={2}`: the node draws a full-screen scrim (`rgba(12,10,9,0.6)`) over the whole artboard including the panel that opened this one, so the second scrim must dim `RecipePanel` too. (#149)
- `title` is required by `SidePanel` for `aria-labelledby` but rendered `sr-only`; the node has no heading. (#149)
- Rows with an empty `name` are filtered out (a freshly appended blank row is not an ingredient yet); this matches the filter `RecipePanel` applies when building `ingredientRefs`. (#149)
- Reset-on-open, not remount: one persistent DOM node; `selected` re-seeds from `selectedIds` when `open` flips false -> true, so the open/close transition keeps a painted frame to interpolate from (same pattern as `RecipePanel`/`CardDetailPanel`). (#103)
- `divider` on every row except the last (`index < length - 1`).

## Token gaps and flags
- Footer row gap 8px -> `gap-inline-sm` (`spacing/inline/gap-sm`, from "Bottom" child `3749:3250`). Panel chrome lives in `SidePanel.tsx`. (#205)

## Gotchas
- The "Opslaan" button must sit inside its own `<div className="flex gap-inline-sm">` row. `SidePanel`'s footer is `flex-col`; a bare `grow basis-0` child applies `flex-basis: 0` on the column axis and collapses to ~0 height (squashed button). Every other `footer=` call site wraps in a row. (#153)
- Ladle stories (`Empty`, `WithSelection`, `Interactive`) include one empty-name row to show the filter, and wrap in `min-h-screen` because a bare static `SidePanel` story crops to a 1280x64 sliver.
