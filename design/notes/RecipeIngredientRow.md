# RecipeIngredientRow
Figma: no component, reference only. Data rows are "Rij" frames (`3717:2926`/`3717:2930`/`3717:2934` in `3717:2844`; latest `4025:10838`/`4025:10616`/`4025:10621` in "Ingredienten" `4025:10610`, screen `4025:10596`), each three `Input-field` instances plus a delete Button. Marker (#318) and link line are Claude-designed on request · Code: `components/molecules/RecipeIngredientRow.tsx` (+ `.stories.tsx`)

## Anatomy
Root flex column (`gap-stack-sm`): optional review marker, the field row, optional link line. Field row is flex `items-start gap-2`:
- Item (name): `InputField` `readOnly`, `trailingIcon="ArrowRightLeft"` (`Icon/Arrow-right-left`, `3957:11145`, not a chevron), `onClick` opens `IngredientSearchPanel` via `RecipePanel`. Never free text (Dev Mode annotation). `flex-1`.
- Aantal (quantity): `InputField type="number"`, free numeric entry, fixed `w-[72px]`.
- Eenheid (unit): `InputField` `options` variant (a native `<select>`, `trailingIcon="ChevronDown"`), options from `UNIT_CODES` translated via `recipes.units.<code>`, fixed `w-[104px]`.
- Trailing icon-only destructive `Button` (`Trash`), `aria-label` = `removeLabel` ("Verwijderen").
- `showLabels` (row 1 only) renders the Item/Aantal/Eenheid labels; rows 2+ are unlabelled (`Title: false`). The `LINE` divider between rows belongs to the list, rendered by `RecipePanel`.

## Deliberate decisions
- No `figma-map.json` entry: Figma never models "a row" as one component, only three `Input-field` instances repeated. One React component is this codebase's own reuse decision; it still gets a Ladle story. (#126)
- Each field exists as two JSX branches (with/without label) rather than a conditional `label`: `InputField` requires `label`+`id` together or neither (`label?: never`), and a `string | undefined` ternary does not satisfy that union without a cast. (#126)
- The Eenheid select follows `Title: false` on rows 2+ since a native `<select>` has a real closed state without a label; `Dropdown`'s labelless mode never had one. (#149)
- Every row carries the delete Button, including row 1. Figma's separate label-only header row (`4025:10611`, columns 130/72/fill) is not a data row and has no button; this codebase folds the labels into row 1 via `showLabels`. (#166)
- `removeDisabled` (set by `RecipePanel` when only one row remains) disables rather than hides the Button, following `PortionStepper`'s `min` precedent: Figma never draws a "last row" state, and hiding would suggest deletion is not always available. (#166)
- Column widths come from the data rows, not the header row: Aantal is a fixed 72px (not 104), Eenheid 104px (`layout_a0356099`), Item fills. Arbitrary-value classes are accepted precedent (`SidePanel` `w-[400px]`, `Sidebar` `w-[198px]`). (#166)
- Review marker `reviewLabel`: a `Tag variant="highlight"` button above the row ("controleren") for imported lines the importer was unsure about; it opens the same picker as the name field (the picker then calls `confirmIngredientMatch`). Without it the layout is unchanged. (#318)
- Link line `linkInfo`: one `text-base font-normal text-text-secondary` line saying what the nutrition calculator uses ("NEVO: <name> · <kcal> kcal per 100 g · 1 <unit> ≈ <g> g", "Eigen ingrediënt: ...", or "Niet gekoppeld, telt niet mee in de voedingswaarden"). `RecipePanel` builds it; after a fresh pick only the name is known until saved. Re-linking keeps a name the user typed ("Selderij") and renames only a row whose name mirrored the old link. (2026-10-07)

## Token gaps and flags
- Two raw `gap-2` (root field row, delete column) carry `spacing-flag:` comments: there is no Figma node for the component, so nothing to bind. (#218)

## Gotchas
- Delete Button vertical alignment: Figma's data rows are `alignItems: center` (node `4025:10818`), so the 40px Button centres against the field box (not the whole column, which on row 1 also stacks a label). The Button column is `self-stretch` (overriding `items-start`), contains an `aria-hidden` invisible spacer (`text-base font-semibold` + `&nbsp;`) when `showLabels` to consume the label block, and wraps the Button in `flex flex-1 items-center`. Do not hard-code the box height: `h-12` is 1px off because the border-box includes the 1px border (real height 50px). Measured centres matched exactly in the labelled and unlabelled stories. (#166)
- Stories: `NeedsReview` (marker), `LinkInfo`, labelled/unlabelled variants.
