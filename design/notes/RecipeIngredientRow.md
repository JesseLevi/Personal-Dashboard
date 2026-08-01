# RecipeIngredientRow

- **Code:** `components/molecules/RecipeIngredientRow.tsx` (+ `.stories.tsx`)
- **Node IDs (reference only, no map entry):** `3717:2926`/`3717:2930`/`3717:2934` ("Rij" frames, `3717:2844`), each three separate `Input-field` instances — `3740:4266`/`3740:4257`/`3740:4275` (row 1, labelled) and the equivalent unlabelled triplets for rows 2/3.

## Why no `design/figma-map.json` entry

Per #126's own instruction: Figma never models "a row" as one named component — it's three independent `Input-field` instances placed side by side, repeated three times with a `LINE` between. Turning that into one React component is this codebase's own reuse decision (three inline-repeated `InputField` triplets would have duplicated a nontrivial amount of markup three times over), not a Figma-sourced component boundary. It still gets a Ladle story, per the same instruction, since it's a real reusable part once built.

## Field mapping

- **Item (name)**: `InputField` with `trailingIcon="ArrowRightLeft"` (`Icon/Arrow-right-left`, `3957:11145` — not a chevron), `readOnly`, `onClick` opens `IngredientSearchPanel` via the composing `RecipePanel`. Never a free-text field — Dev Mode annotation says tapping it opens #131's picker.
- **Aantal (quantity)**: `InputField type="number"`, free numeric entry (`Trekking-icon: false` in Figma — no picker).
- **Eenheid (unit)**: `Dropdown`, not a bare trailing chevron on a static `InputField` — the annotation on this field describes it opening "all measurement types for cooking," i.e. a real list, which `Dropdown` already models (open/closed, `key`-remount-closes-on-select). Options come from `lib/recipes/units.ts`'s `UNIT_CODES` (#120), translated via `recipes.units.<code>`.

`showLabels` controls whether each field renders Figma's `Item`/`Aantal`/`Eenheid` labels — only row 1 (`Title: true`) does; rows 2/3 have `Title: false`. Implemented as two full JSX branches per field rather than a conditional `label` prop, because `InputField`/`Dropdown`'s own prop types require `label`+`id` together or neither (`label?: never`) — a `string | undefined` ternary value doesn't satisfy that union without either branching or an unsafe cast.

**Flagged deviation: the Eenheid column stays labelled on every row, including 2/3.** `Dropdown`'s labelless mode (no `label`/`id`) isn't a real closed picker — its own `return` renders `children` directly with no trigger/collapse logic at all (only the labelled branch has the open/closed chrome), confirmed by reading `Dropdown.tsx` itself, not assumed. Passing `defaultOpen={false}` to the labelless branch is also a compile error (`DropdownProps`'s labelless variant types it as `never`). A compact, closeable unit picker therefore requires the labelled variant unconditionally — the "Eenheid" label renders on every row, not just row 1, a functionally-forced deviation from Figma's `Title: false` on rows 2/3. `docs/open-questions.md#recipe-ingredient-row-unit-label-always-shown`.

## Layout

Row is a flex `items-start` container: name column `flex-1`, quantity/unit columns fixed `w-[104px]` (Figma's own stated `layout_8e752b17`/`layout_a0356099` width) — no Tailwind default-scale utility lands on exactly 104px, so this is an arbitrary-value class (`w-[400px]` on `SidePanel.tsx`, `w-[198px]`/`w-[73px]` on `Sidebar.tsx` are the same established precedent, not a new pattern).

The `LINE` divider between rows (`3740:4821`/`3740:4823`) is rendered by the composing `RecipePanel`, not this component — it belongs to the row *list*, not to any individual row.
