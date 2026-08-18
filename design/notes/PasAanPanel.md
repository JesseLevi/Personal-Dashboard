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

## 2026-08-18 — Eenheid dropdown rendered off-screen on mobile; now flips up

Full mechanism (why, and the `translate`-creates-a-containing-block finding
that ruled out `position: fixed`): `docs/incidents.md` (2026-08-18).

On mobile, `SidePanel`'s bottom sheet (`inset-x-0 bottom-0 max-h-[90vh]`)
hugs its content — "Eenheid" is the last row, so the popover's old fixed
`mt-2` offset landed past the visible sheet, behind the Opslaan footer.
Desktop was never affected (`md:h-full` leaves room below). The dropdown
now goes through `lib/dom/use-popover-position.ts` (shared across all seven
hand-rolled popovers in this codebase) with `anchor="right"`,
`prefer="below"` — its designed placement — and flips to `above` only when
`below` doesn't fit inside `SidePanel`'s scrolling children container.

Re-measured live (Chromium, real compiled CSS, the actual `SidePanel` +
`Card` + row markup) at 320/375/390/430px, viewport height 800: the popover
(94px tall) now flips to `above` at every width, landing fully inside the
scroll area's bounds (e.g. at 390px: popover `top 536 / bottom 630` vs.
bounds `top 528 / bottom 727`). Also confirmed stable at shorter real mobile
heights (390×667, 390×812) — same flip, same containment. The pre-fix
markup (`top-full right-0 mt-2`, no clamp/flip) was reproduced in the same
harness and does overflow, at every width tested: popover bottom `804px`
vs. the panel's own bottom `800px` and the scroll area's bottom `727px` —
outside both the panel and the scrollable region, i.e. exactly the
"behind the footer" symptom reported.

### Off-topic finding (not fixed, noted for the record)

The reused "Card" instance's own title text reads "Dry" (leftover from
the ingredient-card template it was cloned from) rather than
"Ingrediënten" — a pre-existing Figma-mockup labelling artifact, unrelated
to spacing/radius and out of this ticket's scope. `PasAanPanel.tsx` already
renders the correct `t("ingredientsCardTitle")` regardless.
