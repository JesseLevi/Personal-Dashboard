# RecipeIngredientRow

- **Code:** `components/molecules/RecipeIngredientRow.tsx` (+ `.stories.tsx`)
- **Node IDs (reference only, no map entry):** `3717:2926`/`3717:2930`/`3717:2934` ("Rij" frames, `3717:2844`), each three separate `Input-field` instances — `3740:4266`/`3740:4257`/`3740:4275` (row 1, labelled) and the equivalent unlabelled triplets for rows 2/3.

## TICKET #218 (2026-08-12): spacing gate

`scripts/check-raw-spacing.sh` flagged this component's two raw `gap-2`s
(root row, delete-button column). Both `spacing-flag:` comments point back
to "Why no `design/figma-map.json` entry" below — there is no Figma node
for this component at all, so there is nothing to measure or bind against.

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

## TICKET #166 round 1 (2026-08-08) — delete Button added, misread which row has none

Re-fetched via the REST API (`get_figma_data` was down this session) — node `4025:10610` ("Ingredienten"), the refreshed V2 ingredients-edit frame. Confirms a real per-row delete Button that the previous build (#126/#149) never modelled: rows 2+ (`4025:10838`/`4025:10616`/`4025:10621`, each 4 children) carry a trailing icon-only `Button/Default` instance (componentId `3693:3386` — `Atom/Button`'s own `Style=Destructive, State=Default` variant, no new component), `aria-label` sourced from the instance's `Text` override "Verwijderen". **Misread as "row 1 (`4025:10611`) has no such button."** That node is NOT an ingredient row at all — see the round-2 correction below.

## TICKET #166 round 2 (2026-08-08) — correction: `4025:10611` is a label header, not row 1

User feedback: "'Aantal' heeft een aangepaste breedte die niet is meegenomen in de feedback. En het eerste ingredient heeft in dev nu geen delete knop." Re-fetched node `4025:10596` ("02: Add recipi/Mobile") in full — the "Ingredienten" frame (`4025:10610`) actually contains **four** child rows, not three:

- `4025:10611` ("Rij", 3 children) — **label-only header row.** Each child is a bare `Input-field`-shaped `FRAME` containing nothing but a `TEXT` node ("Item"/"Aantal"/"Eenheid") — no `Container`, no border, no delete Button, because there is no actual field here at all, just column headings. Widths: Item 130px, Aantal 72px, Eenheid fill.
- `4025:10838`, `4025:10616`, `4025:10621` ("Rij" ×3, each 4 children) — the **three real data rows**, every one a genuine `Input-field` *instance* (name/quantity/unit) plus a trailing destructive delete Button. Round 1 already found this delete Button but wrongly attributed its absence to the wrong node (`4025:10611`, which was never a data row to begin with).

**Round 1's `index > 0` conditional was fixing a bug that didn't exist in Figma and hiding a real one in dev.** Every actual ingredient row in the design carries a delete Button — including what this codebase renders as its first/labelled row (`showLabels`), which corresponds to Figma's first *data* row (`4025:10838`), not the separate label header. Fixed: `onRemove`/`removeLabel` are now unconditional, required props (no longer an independently-optional pair — the old TS2322 workaround this note used to describe no longer applies, since there is no longer a labelled/unlabelled branch to reconcile). `RecipePanel.tsx` passes them on every row.

**"Delete the only remaining row" — Figma draws no such state** (it always shows exactly three data rows). Rather than silently emptying the ingredient list (breaking `handleSave`'s `title.trim() !== "" && categoryId` guard's implicit assumption that a recipe has content, and leaving no visible row to type into without a page reload) or hiding the button on the last row (which would falsely suggest deletion isn't always available, contradicting "every row has one"), `RecipePanel.tsx` **disables** it via a new `removeDisabled` prop, following the exact precedent `PortionStepper`'s own `min`-floor already set in this codebase (#153: disable-at-floor, not hide-at-floor). `removeDisabled={ingredients.length <= 1}` — the button stays visible and Figma-accurate on every row, just non-interactive when it is the sole remaining one.

**Column widths corrected from the same re-fetch.** Every data row's Aantal field is a **fixed 72px** column (`layout_25c01dc8`, confirmed on all three data rows) — not 104px, which round 1 (and the original #126 build) applied to both Aantal and Eenheid. Eenheid stays 104px (`layout_a0356099`, unchanged, confirmed still correct). Item stays `flex-1`/fill on every row. The label row's own column widths (130/72/fill) are a separate, narrower set that only sizes the header text, not the fields beneath it — not applied to the real fields, per the ticket's own hint that "the label row and the data rows have different column widths, and the data rows are the ones that govern the rendered field widths."

**Row 1's delete Button now needs to vertically align with its input boxes, not its labels.** Because `showLabels` renders visible field labels directly above row 1's boxes (this codebase's own simplification of Figma's separate label-header row — unchanged design decision, see "Why no figma-map.json entry" above), the delete Button — which has no label of its own — would sit flush with the *top* of the row (level with the labels) rather than with the input boxes below them, under a plain `items-start` layout. Fixed with an invisible spacer (`text-base font-semibold` + `&nbsp;`, `aria-hidden`) above the Button whenever `showLabels` is true, reproducing the exact height of `InputField`'s own label block so the Button's top edge lands level with the boxes instead of the labels. Verified in a real browser (Playwright, `pnpm dev`, recipe create panel).

### Correction, same round — top-aligned is not what Figma draws

The invisible-spacer fix above lands the Button's **top edge** level with the input boxes. That is still wrong: node `4025:10818` (the delete Button the user linked) sits in a row whose layout is `alignItems: center`, so the 40px Button is *centred* against the 48px field box, not flush with its top.

Fixed by keeping the spacer (it correctly consumes row 1's label block) and giving the Button column `self-stretch` — overriding the row's `items-start` so the column spans the row's full height — with the Button then wrapped in a `flex-1 items-center` box. `flex-1` resolves to exactly the field box's own height on both branches, so `items-center` centres against the box in the labelled and unlabelled cases alike, without hard-coding a pixel height anywhere.

**Hard-coding that height gets it wrong by 1px, and the error is invisible by inspection.** `h-12` (48px) looks right from `InputField`'s own padding arithmetic (`p-1` 4 + `py-2` 8 + a 24px line, doubled = 48), but the box also carries a 1px border on each edge and is `border-box`, so its real height is **50px**. Measured in a real browser (Playwright against `pnpm ladle`, `getBoundingClientRect`): field box centre and Button centre both land on 89.00 in `recipe-ingredient-row--labelled` and both on 57.00 in `--unlabelled` — exact, on both branches. The earlier `h-12` attempt measured 88.00 vs 89.00.
