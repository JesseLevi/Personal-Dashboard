# RecipePanel

- **Code:** `app/(app)/recepten/RecipePanel.tsx` (page-level composition, not added to `design/figma-map.json` — same precedent as `CardDetailPanel.tsx`/`CategoryPanel.tsx`: it assembles unrelated fields for one form rather than being itself a fetched Figma component).
- **Node IDs:** `3777:3918` ("01: Main/Mobile", the `+` trigger — `I3777:3924;3670:1765;3777:4094;3686:1894`), `3717:2844` ("Add recipi/Mobile", the current field set, brief v2 §A2 — supersedes `3777:3932`'s row structure, unchanged), `3777:3984` ("03: Add recipi/ingredient/Mobile", the confirm-ingredients overlay — read, not built, see below).

Built #126. Fetched all three nodes live via `mcp__figma__get_figma_data` before writing any UI, plus the raw REST annotations the ticket already transcribed (MCP drops Dev Mode annotations — `docs/guides/ui-components.md`'s standing warning).

## One component, create+edit (analogous to #94)

No separate "Recept bewerken" node exists in Figma — `target.mode` follows `CardDetailPanel.tsx`'s precedent exactly, including its reset-on-open (not remount-on-target-change) pattern for the same #105 first-open-animation reason.

## Trigger wiring — create only

`ReceptenBoard.tsx`'s `BoardView` already exposes `onAddItem(columnId)` (#124), fired from each category's header `+` button (`Card-container`'s own `Atom/Button` — the *correct* trigger per the ticket's own "verkeerde annotatie" callout on `3777:3923`/`"Adds a kanban column."`, which is Te-Doen residue, not this panel's trigger). Wired to open `RecipePanel` in `create` mode with that column's id as `categoryId`.

**Edit mode has no wired trigger yet.** `Card-content/Recipe` (`CardContentRecipe.tsx`) draws no pencil/edit affordance — `BoardView`'s `onItemClick` still navigates to `/recepten/[id]` (a detail page that doesn't exist yet, #124's own scope). Building a new edit-entry UI element here would be inventing UI Figma doesn't draw. `RecipePanel`'s `edit` mode is fully implemented and Ladle-testable (`Filled` story passes a real `RecipeWithIngredientsAndSteps`) but is only reachable once the recipe detail page ticket adds a real trigger to it. Flagged: `docs/open-questions.md#recipe-edit-trigger-no-host-yet`.

## Ingredient rows — `RecipeIngredientRow` molecule

Three `Input-field` instances per row (name/quantity/unit), matching `3717:2844`'s three "Rij" frames pixel-for-pixel. Figma models a row as three separate instances, never as one named component, so per the ticket's own instruction this new molecule (`components/molecules/RecipeIngredientRow.tsx`) gets **no** `design/figma-map.json` entry, but does get its own Ladle story (`RecipeIngredientRow.stories.tsx`) since it is a real reusable part. See `design/notes/RecipeIngredientRow.md`.

## Name field: read-only, opens #131's search panel

`I3740:4302;3761:8982`'s annotation ("OnClick slide in #Add recipi/ingredientList/Mobile") only sits on row 2's name field, not rows 1/3 — despite identical structure. Applied to **all three rows** here (least-surprising: a field with the swap icon that only sometimes opens the picker would be worse UX than the annotation gap suggests) — flagged as `docs/open-questions.md#ingredient-name-annotation-only-on-row-two` rather than silently generalised without a note.

`IngredientSearchPanel` (#131) is a multi-select panel (checkbox rows, `onSave(ingredients: IngredientRow[])`). Reused here as a **single-select** picker: `handleIngredientSaved` takes only `selected[0]` and writes it into whichever row's name field was clicked (`ingredientSearch.rowLocalId`). `initialQuery` is seeded with the row's current name — the exact "future caller" use `IngredientSearchPanel`'s own header comment already names for #126.

Two `SidePanel`s can be open at once (this one + `IngredientSearchPanel`'s own) — no z-index conflict: both use the same `z-40`/`z-50` classes, but `IngredientSearchPanel` renders after `RecipePanel`'s own `SidePanel` in the returned JSX, so normal DOM paint order stacks it on top.

## Personen — Dropdown, least-inventive reuse

The trailing chevron's behaviour isn't specified beyond "Trekking-icon: true". Built as a `Dropdown` (reusing `CardDetailPanel.tsx`'s exact `key={value}`-remount-closes-on-select pattern) listing a fixed 1-12 range — unsourced from Figma/product, flagged the same way `SidePanel`'s own drag thresholds are (`design/notes/SidePanel.md`'s #103 entry): a reasonable default, not a design decision.

## Categorie/Tijd/Tags — user-ordered deviation (2026-07-29), not in `3717:2844`/`3777:3932`

None of these three fields exist in either fetched node. Built per direct user instruction: *"Zijn allemaal input fields of dropdowns. Geen nieuwe ui nodig."* — and without a category, a new recipe cannot land in any kanban column at all (`ReceptenBoard.tsx` renders one column per `recipe_categories` row), which would make the create flow unusable.

- **Categorie**: `Dropdown` listing the caller's `recipe_categories`, same trigger pattern as `CardDetailPanel.tsx`'s Status field (`Button` with the category's icon, `align="left"`, doubling as the disclosure trigger). Preselects `target.categoryId` on create (the column whose `+` was clicked) or `recipe.category_id` on edit.
- **Tijd**: plain numeric `InputField`, writes `recipes.time_minutes`.
- **Tags**: see below — the one field that shipped smaller than the ticket's suggested composition, and why.

## Tags — scoped down from the ticket's suggested composition (flagged)

The ticket suggests "`Dropdown` with `Checkbox` rows for the user's existing tags, plus an `InputField` to type a new one." `public.tags`/`recipe_tags` exist in the schema (`TagRow`/`RecipeTagRow` in `lib/recipes/types.ts`) but **no query or server action exists anywhere in this codebase to list, create, or attach a tag** — `lib/recipes/queries.ts` has no `getTags`, `app/(app)/recepten/actions.ts` has no tag action, and `createRecipeSchema`/`updateRecipeSchema` (`lib/recipes/schemas.ts`) accept no `tags` field at all. That plumbing is outside #126's own stated scope (its "Data" section only names ingredients/steps).

Built: the `InputField`-to-add-new-tag half only (fully functional, no backend needed), rendering added tags as removable `Tag` pills (`Button` `size="compact"` `icon="X"`) inside the same `Dropdown` shell the ticket asked for — so the composition is still "existing atoms only, no new component." The "existing tags as Checkbox rows" half is **not built**: there is no query to source it from, and rendering an always-empty checkbox list would be worse than omitting it. **Nothing typed into this field is persisted** — `handleSave`'s payload has no `tags` key, and even if it did, the schemas would silently strip it (`z.object` drops unknown keys by default).

**Superseded 2026-08-02**: #149's feedback drops this field from the panel entirely ("Tags veld mag weg") — `tags`/`recipe_tags` stay in the schema, but this input's own missing query/write path is no longer worth building. The open question tracking that gap (`recipe-tags-no-query-or-write-path`) has been removed from `docs/open-questions.md`; this section is now only a record of what shipped and why it's coming back out.

## Ingrediënt-pill in the step field — deferred, not improvised

The step `Input-field`'s `Button` SLOT ("Ingrediënt") is rendered (Figma draws it) but `disabled` — its annotation says it opens *"another pull-up panel,"* content undesigned anywhere in the file. Wiring a click handler would mean inventing that panel's contents from nothing.

**Speced 2026-08-02 by #149**: the feedback ticket now describes the flow in full — clicking "+ ingredient" on a step opens a pull-up panel pre-filled with the recipe's own ingredients (entered earlier in the form), excluding whatever's already picked for that step, letting the user select which ones belong to this step (Figma node `3749:3091`). Still not built — tracked as implementation work under #149 now, not as an open design question. This is also very likely the same panel described just below ("Screen 03"), which #149 resolves too; the two were never confirmed to be the same node, so both notes stay as separate history.

## Screen 03 — confirm-ingredients overlay, deferred

`3777:3984`'s second `Pull-up panel` (`3777:4012`, a `Card` of three `Card-content/Ingredient` rows with unchecked `Checkbox`es, footer "Oplsaan" only) is **not built**. No Dev Mode annotation explains its purpose, and its own footer duplicates the underlying form's `Opslaan` action with no visible different effect described anywhere — building it would mean guessing both its trigger and its semantics.

**Closed 2026-08-02**: both this and the Ingrediënt-pill question above were removed from `docs/open-questions.md` per user confirmation — #149's spec (above) covers the real behaviour needed here, whether or not this is literally the same Figma node.

## Ingredient/step row affordances — none in v1

No edit/delete/reorder control per ingredient or step row, on either mode (create or edit). Neither is drawn in Figma (`3717:2844` shows exactly three static rows, one static step, no per-row chrome), and adding one would be new UI beyond the fetched node. Two "Voeg toe" buttons append a row each; there is no way to remove one once added except discarding the whole form. Flagged: `docs/open-questions.md#ingredient-step-rows-no-delete-reorder-v1` — a real UX gap, especially on `edit` (a recipe imported with a wrong extra row can't be fixed without recreating it), left for a follow-up ticket rather than inventing a trailing-icon control the source doesn't show.

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

## `updateRecipe`'s replace-not-transactional write (real risk this form now exposes)

`app/(app)/recepten/actions.ts`'s own header comment already documents that `replaceRecipeIngredients`/`replaceRecipeSteps` are delete-then-insert, not one transaction — a successful delete followed by a failing insert leaves a recipe with **no** ingredients or steps. This ticket's edit form is the first real caller that can trigger that window (create's compensating cleanup deletes the whole recipe on the same failure; `updateRecipe` has no equivalent compensation for an existing recipe). Not papered over here — flagged again in the PR body per `CLAUDE.md`'s "flag, don't silently redesign," same as `IngredientSearchPanel.md`'s own `ilike`-not-`pg_trgm` flag.

## Desktop — no new layout decisions

No desktop node exists for the field content (`SidePanel` itself already has both shapes). Every field stays in the same single-column vertical order at every breakpoint — `SidePanel`'s own `md:w-[400px]` shell is wide enough that the ingredient row's fixed 104px quantity/unit columns need no reflow. No grid, no `md:` breakpoint classes added anywhere in this file.

## Open questions raised (`docs/open-questions.md`, appended by this ticket)

- `recipe-edit-trigger-no-host-yet`
- `ingredient-name-annotation-only-on-row-two` (ticket-carried)
- `ingredient-step-rows-no-delete-reorder-v1` (ticket-carried)
- `recipe-panel-verwijderen-hidden-on-create` (ticket-carried, default chosen: hidden)
- `recipe-panel-unit-list-etc-unsourced` (ticket-carried)
- `recipe-panel-personen-chevron-behaviour-unsourced` (ticket-carried)
- `recipe-panel-desktop-layout-gap` (ticket-carried)
- `recipe-panel-photo-upload-not-built` (ticket-carried, shared with #121)
- `recipe-name-field-swap-icon-unusual` (ticket-carried)
- `recipe-panel-two-identical-voeg-toe-buttons` (ticket-carried)

Four more were raised and later closed during `docs/open-questions.md`'s
2026-08-02 cleanup (`recipe-tags-no-query-or-write-path`,
`step-ingredient-pill-panel-undesigned`, `screen-03-overlay-purpose-unclear`,
`recipe-panel-trigger-annotation-misattributed`) — see the Tags and
Ingrediënt-pill/Screen 03 sections above for what's still current.

## Ladle stories

`Empty` (create mode, one empty ingredient row, one empty step), `Filled` (edit mode, three ingredient rows incl. one with and one without `ingredientId`, two steps). Mock `onCreateRecipe`/`onUpdateRecipe`/`onDeleteRecipe`/`onSearchIngredients`/`onCreateOwnIngredient` never import the real action module, matching `CardDetailPanel.stories.tsx`'s precedent. Wrapped in `<div className="min-h-screen">` — `SidePanel.stories.tsx`'s known trap (a bare static `SidePanel` story crops to a 1280x64 sliver).
