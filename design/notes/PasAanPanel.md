# PasAanPanel (`app/(app)/recepten/[recipeId]/PasAanPanel.tsx`)

- **Code:** `app/(app)/recepten/[recipeId]/PasAanPanel.tsx` (`"use client"`,
  page-level composition reusing `SidePanel` — same non-mapped-component
  precedent as `RecipePanel.tsx`/`CategoryPanel.tsx`, **not** added to
  `design/figma-map.json`).
- **Node IDs:** `Recept/Mobile/PasAan/Dropdown` (`3997:25600`, pull-up panel
  `3998:10701`) / `Recept/Desktop/PasAan/Dropdown` (`3999:10604`, slide-in
  panel `3999:10877`). The panel's own content card ("Ingrediënten",
  Personen/Eenheid rows) is `3998:10928` inside the mobile pull-up panel.

Built #160. Full field/behaviour reasoning (Personen control, dropped
"Verwijderen", session-only draft state) lives in
`design/notes/RecipeDetailPage.md` — this file only carries this
component's own design-record entries (currently just #219, below), per the
"one home per fact" rule.

## #219 — raw radius/spacing utility, measured via `figma-console`

Both content rows ("Personen" and "Eenheid") map to the same Figma template
node, "Card-content/Ingredient" (`Card` instance `3998:10928`, `Type` slot
`I3998:10928;3997:25437`), which the mockup reuses to render the Personen
and Eenheid rows text-swapped in place of an ingredient name/quantity —
confirmed via `findAll` on the "Pull-up panel" subtree turning up "Personen"
(`I3998:10928;3997:25437;3998:10987`) and "Eenheid"
(`I3998:10928;3997:25437;3998:11033`) as the actual text content.

| Line | Old | New | Node | `boundVariables` key | Figma variable |
|---|---|---|---|---|---|
| 96 | `gap-5` (Personen row) | `gap-inline-xl` | `I3998:10928;3997:25437;3998:10985` | `itemSpacing` | `spacing/inline/gap-xl` |
| 96 | `py-3` | `py-component-md` | same | `paddingTop`/`paddingBottom` | `spacing/component/padding-md` |
| 96 | `pl-3` | `pl-component-md` | same | `paddingLeft` | `spacing/component/padding-md` |
| 96 | `pr-3` | `pr-component-md` | same | `paddingRight` | `spacing/component/padding-md` |
| 107 | `gap-5` (Eenheid row) | `gap-inline-xl` | `I3998:10928;3997:25437;3998:11031` | `itemSpacing` | `spacing/inline/gap-xl` |
| 107 | `py-3` | `py-component-md` | same | `paddingTop`/`paddingBottom` | `spacing/component/padding-md` |
| 107 | `pl-3` | `pl-component-md` | same | `paddingLeft` | `spacing/component/padding-md` |
| 107 | `pr-3` | `pr-component-md` | same | `paddingRight` | `spacing/component/padding-md` |

Both rows resolve `itemSpacing: 20` and `pad: [12,12,12,12]`, pixel-identical
to the original `gap-5`/`py-3`/`pl-3`/`pr-3` (20px/12px), on both `Card-content/Ingredient`
instances.

### Flagged

- **Eenheid dropdown offset `mt-2`** (line ~118): the Unit-selector popover
  (US/Metric options) has no Figma node — the fetched "PasAan/Dropdown"
  frames only show the collapsed `Eenheid` button ("Amerikaans" label), no
  expanded/open state. No binding to measure.

### Off-topic finding (not fixed, noted for the record)

The reused "Card" instance's own title text reads "Dry" (leftover from
the ingredient-card template it was cloned from) rather than
"Ingrediënten" — a pre-existing Figma-mockup labelling artifact, unrelated
to spacing/radius and out of this ticket's scope. `PasAanPanel.tsx` already
renders the correct `t("ingredientsCardTitle")` regardless.
