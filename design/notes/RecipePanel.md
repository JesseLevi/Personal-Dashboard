# RecipePanel

- **Code:** `app/(app)/recepten/RecipePanel.tsx` (page-level composition, not added to `design/figma-map.json` — same precedent as `CardDetailPanel.tsx`/`CategoryPanel.tsx`: it assembles unrelated fields for one form rather than being itself a fetched Figma component).
- **Node IDs:** `3777:3918` ("01: Main/Mobile", the `+` trigger — `I3777:3924;3670:1765;3777:4094;3686:1894`), `3717:2844` ("Add recipi/Mobile", the current field set, brief v2 §A2 — supersedes `3777:3932`'s row structure, unchanged), `3777:3984` ("03: Add recipi/ingredient/Mobile", the confirm-ingredients overlay — read, not built, see below).

Built #126. Fetched all three nodes live via `mcp__figma__get_figma_data` before writing any UI, plus the raw REST annotations the ticket already transcribed (MCP drops Dev Mode annotations — `docs/guides/ui-components.md`'s standing warning).

Extended #149: Tags removed (never had a write path — see below), an Afbeelding field added (`ImageUploadField`, upload-on-save), Personen switched from `Dropdown` to `InputField`'s new `options` (select) variant, and each step gained a working "+ Ingrediënt" picker (`StepIngredientPanel`) — see the dedicated sections below for each.

## One component, create+edit (analogous to #94)

No separate "Recept bewerken" node exists in Figma — `target.mode` follows `CardDetailPanel.tsx`'s precedent exactly, including its reset-on-open (not remount-on-target-change) pattern for the same #105 first-open-animation reason.

## Trigger wiring — create only

`ReceptenBoard.tsx`'s `BoardView` already exposes `onAddItem(columnId)` (#124), fired from each category's header `+` button (`Card-container`'s own `Atom/Button` — the *correct* trigger per the ticket's own "verkeerde annotatie" callout on `3777:3923`/`"Adds a kanban column."`, which is Te-Doen residue, not this panel's trigger). Wired to open `RecipePanel` in `create` mode with that column's id as `categoryId`.

**Edit mode had no wired trigger until #127.** `Card-content/Recipe` (`CardContentRecipe.tsx`) still draws no pencil/edit affordance, but `/recepten/[recipeId]` (#127, `design/notes/RecipeDetailPage.md`) now opens this same `RecipePanel` in `edit` mode from its own "Bewerken" button/menu item, passing the fetched `RecipeWithIngredientsAndSteps` straight through as `target.recipe` — exactly the shape the `Filled` Ladle story already exercised. **Closed 2026-08-02**, removed from `docs/open-questions.md`.

## Ingredient rows — `RecipeIngredientRow` molecule

Three `Input-field` instances per row (name/quantity/unit), matching `3717:2844`'s three "Rij" frames pixel-for-pixel. Figma models a row as three separate instances, never as one named component, so per the ticket's own instruction this new molecule (`components/molecules/RecipeIngredientRow.tsx`) gets **no** `design/figma-map.json` entry, but does get its own Ladle story (`RecipeIngredientRow.stories.tsx`) since it is a real reusable part. See `design/notes/RecipeIngredientRow.md`.

## Name field: read-only, opens #131's search panel

`I3740:4302;3761:8982`'s annotation ("OnClick slide in #Add recipi/ingredientList/Mobile") only sits on row 2's name field, not rows 1/3 — despite identical structure. Applied to **all three rows** here (least-surprising: a field with the swap icon that only sometimes opens the picker would be worse UX than the annotation gap suggests) — flagged as `docs/open-questions.md#ingredient-name-annotation-only-on-row-two` rather than silently generalised without a note.

`IngredientSearchPanel` (#131) is a multi-select panel (checkbox rows, `onSave(ingredients: IngredientRow[])`). Reused here as a **single-select** picker: `handleIngredientSaved` takes only `selected[0]` and writes it into whichever row's name field was clicked (`ingredientSearch.rowLocalId`). `initialQuery` is seeded with the row's current name — the exact "future caller" use `IngredientSearchPanel`'s own header comment already names for #126.

Two `SidePanel`s can be open at once (this one + `IngredientSearchPanel`'s own) — no z-index conflict: both use the same `z-40`/`z-50` classes, but `IngredientSearchPanel` renders after `RecipePanel`'s own `SidePanel` in the returned JSX, so normal DOM paint order stacks it on top.

## Personen — `InputField`'s `options` (select) variant (#149, supersedes `Dropdown`)

The trailing chevron's behaviour still isn't annotated beyond "Trekking-icon: true" — that part is unchanged and stays flagged (`docs/open-questions.md#recipe-panel-personen-chevron-behaviour-unsourced`). What changed in #149 is the *widget*, not the range: Figma models Personen (`3968:10298`) as the same `Input-field` component with a chevron, never a separate `Atom/Dropdown` instance, so `#126`'s `Dropdown` build was a mismatch (this is what produced the reported "Personen looks wrong" feedback). Rebuilt on `InputField`'s new `options` variant (`design/notes/InputField.md`'s #149 entry) — same fixed 1-12 range as before, still unsourced from Figma/product, flagged the same way `SidePanel`'s own drag thresholds are (`design/notes/SidePanel.md`'s #103 entry): a reasonable default, not a design decision.

## Afbeelding — `ImageUploadField`, upload-on-save (#149)

`3777:3932` draws a "Selecteer afbeelding" field between Titel and Personen — #121 built the `ImageUploadField` molecule and the storage/signed-URL plumbing (`lib/recipes/thumbnails.ts`) but no form ever rendered the control. #149 wires it in at that same position: `thumbnailFile` (a plain `File | null`, `null` meaning "keep the existing thumbnail" on edit or "no photo" on create) is local state, uploaded only from `handleSave` — never eagerly on file pick — via the new `onUploadThumbnail` prop (`"use server"` `uploadRecipeThumbnail`, `app/(app)/recepten/actions.ts`), so a cancelled form never orphans a storage object. The upload runs *before* the create/update call (awaited, not parallel) because its result (`thumbnailPath`) is part of the same payload; on edit with no new file picked, `thumbnailPath` is left out of the payload entirely so `updateRecipeSchema`'s per-field-optional contract leaves the stored `thumbnail_path` untouched. `selectedFileName` shows the picked file's name, or — on edit, before a new file is picked — `recipe.thumbnail_path`'s own basename as a best-effort approximation of a filename (the storage path is `<user_id>/<uuid>.<ext>`, not a stored original name). Closes the `recipe-panel-photo-upload-not-built` open question, removed from `docs/open-questions.md` by this ticket.

## Categorie/Tijd — user-ordered deviation (2026-07-29), not in `3717:2844`/`3777:3932`

Neither field exists in either fetched node. Built per direct user instruction: *"Zijn allemaal input fields of dropdowns. Geen nieuwe ui nodig."* — and without a category, a new recipe cannot land in any kanban column at all (`ReceptenBoard.tsx` renders one column per `recipe_categories` row), which would make the create flow unusable.

- **Categorie**: `Dropdown` listing the caller's `recipe_categories`, same trigger pattern as `CardDetailPanel.tsx`'s Status field (`Button` with the category's icon, `align="left"`, doubling as the disclosure trigger). Preselects `target.categoryId` on create (the column whose `+` was clicked) or `recipe.category_id` on edit.
- **Tijd**: plain numeric `InputField`, writes `recipes.time_minutes`.

A third field, Tags, was built alongside these two in #126 and removed again in #149 — see below.

## Tags — removed (#149)

#126 shipped only the "type a new tag, render it as a removable pill" half of the ticket's suggested composition: `public.tags`/`recipe_tags` exist in the schema but no query/action/schema field ever existed to list, create, or attach one, so nothing typed into the field was ever persisted (`handleSave`'s payload had no `tags` key, and the schemas would have silently stripped it either way). #149 removes the field entirely, per the same reasoning that flagged it in the first place — a field that visibly accepts input and silently discards it is worse than no field. Closes the `recipe-tags-no-query-or-write-path` open question, removed from `docs/open-questions.md`; a future data-layer ticket can reintroduce Tags once `getTags`/an attach action/a schema field exist to back it.

## Ingrediënt-pill in the step field — built (#149, `StepIngredientPanel`)

#126 rendered the step `Input-field`'s `Button` SLOT ("Ingrediënt") `disabled` because its annotated target — "another pull-up panel" — had no Figma source anywhere in the file at the time. It does now (`3749:3091`/`3749:3241`, fetched for #149): the pill opens `StepIngredientPanel` (`components/organisms/StepIngredientPanel.tsx`, full reasoning in `design/notes/StepIngredientPanel.md`), a per-step picker over this panel's own local ingredient rows. The pill's label grows a `(count)` suffix once a step has a selection — this codebase's own judgement call, no Figma count badge exists on this pill. Closes the `step-ingredient-pill-panel-undesigned` open question, removed from `docs/open-questions.md`.

## Step↔ingredient wiring — local-id state, translated to `ingredientRefs` at save time (#149)

Each `StepRowState` carries `ingredientLocalIds: string[]`, referencing `IngredientRowState.localId` — never a database id, since on `create` the ingredient rows themselves don't have one yet. `StepIngredientPanel` reads/writes this array through plain props (`selectedIds`/`onSave`), the same "props in, callback out" shape `IngredientSearchPanel` already uses.

**The translation into payload `ingredientRefs` (array indexes) happens in `buildContentsPayload`, and only after the empty-name filter, never before it.** `ingredientRefs` are indexes into the payload's own `ingredients` array — the array the server actually receives — and that array only contains rows that survive `row.name.trim() !== ""`. Building the local-id→index map from the *unfiltered* `ingredients` state would produce indexes that either point at the wrong row (once a blank row ahead of it is dropped) or reference a row that was dropped entirely. So `buildContentsPayload` filters first, builds `indexByLocalId` from the filtered array, and only then maps each step's `ingredientLocalIds` through that map (silently dropping any id that didn't survive filtering — an unnamed ingredient row was never a real ingredient to begin with). See `lib/recipes/schemas.ts`'s own `ingredientRefs` comment for the receiving end of this contract.

**Reloading a saved recipe reverses the same translation.** `ingredientRowsFromRecipe` seeds each row's `sourceId` from `recipe_ingredients.id` (edit mode only; `null` for a freshly typed row). `stepRowsFromRecipe` now takes that resolved `ingredientRows` array as a second argument — never a fresh second call to `ingredientRowsFromRecipe(recipe)` — builds a `sourceId → localId` map from it, and uses each `RecipeStepWithIngredients.ingredientIds` (real `recipe_ingredients.id` values) to look up the matching `localId`s. Reusing the exact array already assigned to the `ingredients` state matters: `localId`s are minted once by `nextRowId`, and a second `ingredientRowsFromRecipe` call would mint different ones, breaking the `sourceId` lookup silently rather than loudly.

## Screen 03 — confirm-ingredients overlay, resolved by #149

`3777:3984`'s second `Pull-up panel` (`3777:4012`, a `Card` of three `Card-content/Ingredient` rows with unchecked `Checkbox`es, footer "Oplsaan" only) carried no Dev Mode annotation, so #126 deferred it rather than guess its trigger and semantics. #149 answered it: `3749:3241` on frame `3749:3091` is the same panel, and the user's own feedback on the issue names its purpose — it is the per-step ingredient picker, opened by a step's "+ Ingrediënt" pill, and its "Opslaan" commits that step's selection, not the recipe. Built as `StepIngredientPanel`; the `screen-03-overlay-purpose-unclear` entry is removed from `docs/open-questions.md`.

## Ingredient/step row affordances — ingredients resolved (#166), steps still none

**Superseded by #166 for ingredients** — see `design/notes/RecipeIngredientRow.md`'s #166 entries: every real ingredient data row now has a working, Figma-sourced destructive delete Button (`removeDisabled` only when it's the sole remaining row). Steps still have no delete/reorder control in either mode — no fetched node draws one (`3717:2844`/`4025:10628` show only the "Ingrediënt" button slot). One "Voeg toe" button still appends a step row; there is no way to remove one once added except discarding the whole form. Flagged: `docs/open-questions.md#step-rows-no-delete-reorder` (renamed/narrowed by #166) — a real UX gap on `edit`, left for a follow-up ticket rather than inventing a trailing-icon control the source doesn't show.

## Empty/new row shape — a build decision, not a literal read

No blank row is drawn anywhere in Figma. A newly appended row gets the same three fields as any other (`emptyIngredientRow()`/`emptyStepRow()`), unit defaulted to `"gram"` (a sane default so the row validates immediately rather than requiring an extra "pick a unit" step before it can ever save) rather than left unset.

## i18n corrections (ADR-0007, `docs/guides/ui-components.md`)

Every literal source typo/placeholder is corrected in the catalog, never reproduced:

| Source (Figma) | Catalog value |
| --- | --- |
| "Oplsaan" | `saveLabel`: "Opslaan" / "Save" |
| "Step 1" (English label on a Dutch-only screen) | `fields.stepLabel`: "Stap {number}" / "Step {number}" |
| "Blueberry Protein \LPacked Muffins" (stray `\L`) | Never used as a translation key — sample content only in the Filled Ladle story, with the artefact stripped |
| "Proteine poeder" (missing diaeresis) | Sample content stays as literal Ladle story fixture data (not a translation key at all — it's a per-row `name` value from a fictional recipe, same treatment as "Halumi" in `design/notes/IngredientSearchPanel.md`), not corrected in the catalog since it never reaches one |

## `updateRecipe`'s write is now transactional (resolved #149)

#126 flagged that `replaceRecipeIngredients`/`replaceRecipeSteps` were delete-then-insert, not one transaction — a successful delete followed by a failing insert could leave a recipe with **no** ingredients or steps, and `updateRecipe` had no compensation for an existing recipe the way `createRecipe` does for a brand-new one. #149's data-layer commit resolves this: both actions now call a single `public.replace_recipe_contents` RPC (`supabase/migrations/20260802000001_recipe_step_ingredients.sql`), a real Postgres transaction that replaces ingredients, steps, and their `recipe_step_ingredients` links in one round trip. No longer an open risk.

## Desktop — no new layout decisions

No desktop node exists for the field content (`SidePanel` itself already has both shapes). Every field stays in the same single-column vertical order at every breakpoint — `SidePanel`'s own `md:w-[400px]` shell is wide enough that the ingredient row's fixed 104px quantity/unit columns need no reflow. No grid, no `md:` breakpoint classes added anywhere in this file.

## Open questions raised (`docs/open-questions.md`, appended by this ticket)

Still open:

- `recipe-edit-trigger-no-host-yet`
- `ingredient-name-annotation-only-on-row-two` (ticket-carried)
- `step-rows-no-delete-reorder` (renamed/narrowed by #166 — ingredients resolved, steps still open)
- `recipe-panel-verwijderen-hidden-on-create` (ticket-carried, default chosen: hidden)
- `recipe-panel-unit-list-etc-unsourced` (ticket-carried)
- `recipe-panel-personen-chevron-behaviour-unsourced` (ticket-carried, widget changed #149, range/behaviour still unsourced)
- `recipe-panel-desktop-layout-gap` (ticket-carried)
- `recipe-name-field-swap-icon-unusual` (ticket-carried)
- `recipe-panel-two-identical-voeg-toe-buttons` (ticket-carried)

Closed earlier, during `docs/open-questions.md`'s 2026-08-02 cleanup: `recipe-panel-trigger-annotation-misattributed` (ticket-carried, `3777:3923`) — the overview `+` button's "Adds a kanban column" annotation is Te-Doen residue; #126 already wired the correct nested trigger annotation instead, so there was never anything to build.

Closed by #149: `recipe-tags-no-query-or-write-path` (field removed), `step-ingredient-pill-panel-undesigned` (`StepIngredientPanel` built), `recipe-panel-photo-upload-not-built` (`ImageUploadField` wired in), `screen-03-overlay-purpose-unclear` (same panel, purpose named by the user on #149).

## #166 round 2 (2026-08-08) — second feedback pass

Aantal width and the missing row-1 delete Button (`design/notes/RecipeIngredientRow.md`'s round-2 entry), the Personen pill rebuild (`design/notes/PortionStepper.md`'s round-2 entry, `PasAanPanel.tsx`'s only call site needed no change), and the whole-field-clickable / hover-active-focus fix (`design/notes/InputField.md`'s #166 entry, `design/notes/ImageUploadField.md`'s #166 entry) each live in their own component's note — this file only points at them since none of round 2's changes touched `RecipePanel.tsx`'s own field composition beyond the ingredient-row delete wiring (now unconditional, `removeDisabled={ingredients.length <= 1}`) and the Categorie `Dropdown` trigger, which was audited for state-parity and left unchanged (its `Button` trigger already carries Filled's own hover/active ramp — see `InputField.md`'s #166 entry for why that reads as consistent rather than needing InputField's border-based states bolted on).

## Ladle stories

`Empty` (create mode, one empty ingredient row, one empty step), `Filled` (edit mode, three ingredient rows incl. one with and one without `ingredientId`, two steps). Mock `onCreateRecipe`/`onUpdateRecipe`/`onDeleteRecipe`/`onSearchIngredients`/`onCreateOwnIngredient`/`onUploadThumbnail` (#149) never import the real action module, matching `CardDetailPanel.stories.tsx`'s precedent. `Filled`'s sample recipe now seeds `steps[0].ingredientIds` with two of its ingredient rows' ids (#149), exercising `stepRowsFromRecipe`'s `sourceId → localId` reload path rather than always starting from an empty selection. Wrapped in `<div className="min-h-screen">` — `SidePanel.stories.tsx`'s known trap (a bare static `SidePanel` story crops to a 1280x64 sliver).

## #219

Raw radius/spacing utilities converted onto `Semantics / Responsive` tokens,
each verified against a real Figma `boundVariables` read (the "measure, don't
infer from the number" rule this ticket exists to enforce) — bridge reads
against `3717:2844`/`3717:2493` ("Add recipi" Mobile/Desktop, this file's own
cited nodes) and their `3717:2925`/`3957:11670` "Ingredienten" child.

**Footer button rows (lines 383, 404), `gap-2` → `gap-inline-sm`:** same
`SidePanel.tsx` "Bottom" footer template (`3779:4858` mobile / `3779:4950`
desktop, `itemSpacing: 8` → `spacing/inline/gap-sm`) already cited by
`CardDetailPanel.md`, `BoardPanel.md`, `IngredientSearchPanel.md`,
`StepIngredientPanel.md` and this ticket's own `CategoryPanel.md#219` entry
— one shared structural node, reused by every `SidePanel` composer's footer
row regardless of button count. Row 383 is the delete-confirming state
(`Annuleren`/`Verwijderen`), row 404 is the default state
(`Verwijderen`/`Opslaan`).

**Ingredienten wrapper (line 513) and per-row wrapper (line 515), `gap-4` →
`gap-stack-lg`:** both measured against the same "Ingredienten" node
(`3717:2925` mobile / `3957:11670` desktop) — `layoutMode: VERTICAL`,
`itemSpacing: 16`, `boundVariables.itemSpacing` → `spacing/stack/stack-lg`.
Figma's own node is a *flat* list of children (`Rij`, `Line`, `Rij`, `Line`,
`Rij`, …) with that single 16px `itemSpacing` applying uniformly between
every sibling pair. The code introduces one extra nesting level Figma
doesn't have — each row's own `<div key={row.localId} className="flex
flex-col gap-stack-lg">` groups a conditional divider with its
`RecipeIngredientRow` — but the 16px value it reuses is the exact same
binding both between groups (outer wrapper) and between a divider and its
row (inner wrapper), since Figma's flat list spaces divider→row and
row→row identically. One measured node, applied at both nesting levels
rather than two separate reads. Column axis in both code (`flex-col`) and
Figma (`layoutMode: VERTICAL`) → `stack/*`, per the axis rule.

**Stappen list (line ~553), `gap-4` left unconverted, `spacing-flag`:**
carried over verbatim from the previous agent's own in-line comment — no
Figma node exists for a Stappen (steps) list in either `3717:2844` or
`3717:2493`; both "Add recipi" pull-up panels only draw Titel/Personen/Tijd
fields, Ingredienten, and the footer. Converting this would be a
guess-from-matching-number (4 also appears in `component/*`), not a
measurement, so it stays raw with the flag pointing here. No Figma frame to
cite for this one — that is the finding.
