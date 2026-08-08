# RecipeIngredientRow

- **Code:** `components/molecules/RecipeIngredientRow.tsx` (+ `.stories.tsx`)
- **Node IDs (reference only, no map entry):** `3717:2926`/`3717:2930`/`3717:2934` ("Rij" frames, `3717:2844`), each three separate `Input-field` instances — `3740:4266`/`3740:4257`/`3740:4275` (row 1, labelled) and the equivalent unlabelled triplets for rows 2/3.

## Why no `design/figma-map.json` entry

Per #126's own instruction: Figma never models "a row" as one named component — it's three independent `Input-field` instances placed side by side, repeated three times with a `LINE` between. Turning that into one React component is this codebase's own reuse decision (three inline-repeated `InputField` triplets would have duplicated a nontrivial amount of markup three times over), not a Figma-sourced component boundary. It still gets a Ladle story, per the same instruction, since it's a real reusable part once built.

## Field mapping

- **Item (name)**: `InputField` with `trailingIcon="ArrowRightLeft"` (`Icon/Arrow-right-left`, `3957:11145` — not a chevron), `readOnly`, `onClick` opens `IngredientSearchPanel` via the composing `RecipePanel`. Never a free-text field — Dev Mode annotation says tapping it opens #131's picker.
- **Aantal (quantity)**: `InputField type="number"`, free numeric entry (`Trekking-icon: false` in Figma — no picker).
- **Eenheid (unit)**: `InputField`'s `options` (select) variant (#149, replacing `Dropdown` — see below), a real `<select>` with `trailingIcon="ChevronDown"`. Options come from `lib/recipes/units.ts`'s `UNIT_CODES` (#120), translated via `recipes.units.<code>`.

`showLabels` controls whether each field renders Figma's `Item`/`Aantal`/`Eenheid` labels — only row 1 (`Title: true`) does; rows 2/3 have `Title: false`. Implemented as two full JSX branches per field rather than a conditional `label` prop, because `InputField`'s own prop types require `label`+`id` together or neither (`label?: never`) — a `string | undefined` ternary value doesn't satisfy that union without either branching or an unsafe cast.

**RESOLVED (#149), was flagged: the Eenheid column used to stay labelled on every row, including 2/3.** `Dropdown`'s labelless mode (no `label`/`id`) was never a real closed picker — its own `return` rendered `children` directly with no trigger/collapse logic at all (only the labelled branch had the open/closed chrome). A native `<select>` (via `InputField`'s new `options` variant) has a real closed state with or without a visible label — Eenheid can now genuinely follow Figma's `Title: false` on rows 2/3, unlabelled and still compact. `docs/open-questions.md#recipe-ingredient-row-unit-label-always-shown` is closed.

## Layout

Row is a flex `items-start` container: name column `flex-1`, quantity/unit columns fixed `w-[104px]` (Figma's own stated `layout_8e752b17`/`layout_a0356099` width) — no Tailwind default-scale utility lands on exactly 104px, so this is an arbitrary-value class (`w-[400px]` on `SidePanel.tsx`, `w-[198px]`/`w-[73px]` on `Sidebar.tsx` are the same established precedent, not a new pattern).

The `LINE` divider between rows (`3740:4821`/`3740:4823`) is rendered by the composing `RecipePanel`, not this component — it belongs to the row *list*, not to any individual row.

## TICKET #166 (2026-08-08) — delete Button added

Re-fetched via the REST API (`get_figma_data` was down this session) — node `4025:10610` ("Ingredienten"), the refreshed V2 ingredients-edit frame. Confirms a real per-row delete Button that the previous build (#126/#149) never modelled: rows 2+ (`4025:10838`/`4025:10616`/`4025:10621`, each 4 children) carry a trailing icon-only `Button/Default` instance (componentId `3693:3386` — `Atom/Button`'s own `Style=Destructive, State=Default` variant, no new component), `aria-label` sourced from the instance's `Text` override "Verwijderen". **Row 1 (`4025:10611`, the labelled/`showLabels` row, 3 children) has no such button** — deleting down to zero rows isn't a state Figma draws, so this is modelled as an opt-in `onRemove`/`removeLabel` pair, rendered only when BOTH are truthy (checked independently at render — `RecipePanel.tsx` passes them via a conditional object spread inside a `.map()`, which doesn't preserve a discriminated union's cross-field correlation through JSX's attribute-merging typechecking; tried, TS2322, reverted to two independently-optional props). `RecipePanel.tsx` only passes them for `index > 0`.
