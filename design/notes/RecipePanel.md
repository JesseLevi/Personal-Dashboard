# RecipePanel
Figma: `Add recipi/Mobile` `3777:3932` (field set refreshed under `3717:2844`, desktop `3717:2493`), `01: Main/Mobile` `3777:3918` (the `+` trigger), `03: Add recipi/ingredient/Mobile` `3777:3984` / `3749:3091` (step-ingredient picker) · Code: `app/(app)/recepten/RecipePanel.tsx` (page-level composition, not in `figma-map.json`, same precedent as `CardDetailPanel` / `CategoryPanel`)

## Anatomy
One `SidePanel` for create and edit (`target.mode`; no separate "Recept bewerken" node exists). Fields in order: Titel, Afbeelding (`ImageUploadField`), Categorie (`Dropdown`), Personen (`InputField` `options`), Tijd, ingredient rows (`RecipeIngredientRow`, no `figma-map.json` entry since Figma draws three loose `Input-field`s per row), step fields (multiline `InputField` with a "+ Ingrediënt" `Button` slot), footer Verwijderen (edit only) + Opslaan. Two nested panels: `IngredientSearchPanel` (`level={2}`) and `StepIngredientPanel`. One column at every breakpoint; no `md:` classes (`SidePanel` is wide enough for the fixed 104px quantity/unit columns).

## Deliberate decisions
- Reset-on-open (not remount on target change), same pattern as `CardDetailPanel` / `CategoryPanel` (#105, #126).
- Trigger wiring: create via each column's `+` (through `AddRecipeMenu` "Handmatig"). Edit is opened from the recipe detail page, passing the fetched `RecipeWithIngredientsAndSteps` as `target.recipe`; cards draw no pencil (#126, #127). The overview `+` annotation "Adds a kanban column" is Te-Doen residue, not this panel's trigger.
- The ingredient name field is read-only and opens `IngredientSearchPanel` on all rows, though Figma annotates only row 2. A swap icon that only sometimes opens the picker would be worse (#126).
- `IngredientSearchPanel` is multi-select but reused as a single-select picker: `handleIngredientSaved` takes `selected[0]` into the clicked row; `initialQuery` is the row's current name. A user-typed name stays when only the link changes; a name that merely mirrored the old link follows the new one. A hand-typed name stays recipe-only (`ingredientId` null) (#126, #324).
- Both `SidePanel`s can be open at once; `IngredientSearchPanel` renders after, so DOM paint order stacks it on top (#126).
- Personen is `InputField`'s `options` (select) variant, not `Dropdown`: Figma (`3968:10298`) models it as the same `Input-field` with a chevron (#149).
- Afbeelding uploads on save, never on pick, so a cancelled form orphans no object. The upload (client `downscaleImageFile`, fails open, then `onUploadThumbnail`) is awaited before create/update because `thumbnailPath` is in the same payload; with no new file, `thumbnailPath` is left out so the stored value stays untouched. On edit the field shows the existing path's basename (best available approximation; no original filename is stored) (#149, #174).
- Categorie and Tijd are not in either Figma node; built on direct user instruction ("input fields or dropdowns, no new UI"). Without a category a recipe lands in no kanban column. Categorie reuses `CardDetailPanel`'s Status trigger pattern (filled `Button` with the category icon, `align="left"`), preselecting `target.categoryId` or `recipe.category_id`; non-`IconName` icons fall back to `FolderClosed`, as in `ReceptenBoard` (#126).
- Tags were removed: no query/action/schema field ever persisted them, and a field that accepts input then discards it is worse than none (#149).
- Step "+ Ingrediënt" pill opens `StepIngredientPanel` (`design/notes/StepIngredientPanel.md`), a per-step picker over this panel's local ingredient rows; its "Opslaan" commits that step's selection, not the recipe. The `(count)` suffix on the pill is our own judgement call, no Figma badge (#149).
- Step-to-ingredient links are held as local ids (`StepRowState.ingredientLocalIds`), since create-mode rows have no database id (#149).
- A new row is built as the same three fields as any other, unit defaulted to `"gram"` so it validates immediately; no blank row is drawn in Figma (#126).
- Ingredient rows each carry a delete `Button`, disabled only on the sole remaining row (`removeDisabled={ingredients.length <= 1}`) (#166).
- Verwijderen is hidden on create (nothing to delete) and uses `DeleteConfirm` on edit; no Figma source either way (#126).
- `updateRecipe` writes ingredients, steps and links through a single `replace_recipe_contents` RPC (one transaction), so a failing insert cannot leave a recipe with no contents (#149).
- Import (#318): edit rows carry `groupLabel` and `needsReview` (`lib/recipes/panel-payload.ts`). A save clears `needs_review` only on a line whose name, quantity, unit or ingredient link the user changed, or that was confirmed via the picker (`confirmIngredientMatch`, which also stores an alias); untouched flagged lines keep the flag. `linkInfo` (Claude-designed on request) shows what the nutrition calculator uses per row: NEVO or own link, kcal, grams per unit while the unit is still the loaded one.
- i18n corrects Figma typos in the catalog: "Oplsaan" -> `saveLabel` "Opslaan"/"Save"; "Step 1" -> `fields.stepLabel` "Stap {number}"/"Step {number}". Ladle sample content keeps its fixture spelling (it never reaches a catalog).

## Token gaps and flags
- Stappen list wrapper uses raw `gap-4` behind a `spacing-flag:`: neither "Add recipi" frame draws a Stappen list, so converting it would guess from a number (#219). The Ingredienten wrappers use `gap-stack-lg` (measured `3717:2925` / `3957:11670`, `itemSpacing` 16 bound to `spacing/stack/stack-lg`); Figma's list is flat, the code nests each divider with its row but the 16px binding holds at both levels (#219).
- Footer button rows use `gap-inline-sm` (shared `SidePanel` "Bottom" template `3779:4858` / `3779:4950`, `itemSpacing` 8) (#219).
- Personen range 1-12 is unsourced (not from Figma or product), a reasonable default like `SidePanel`'s drag thresholds.

## Gotchas
- `buildContentsPayload` translates local ids to `ingredientRefs` (array indexes) only after dropping empty-name rows. Building the map from the unfiltered state would point at the wrong row or a dropped one. See the `ingredientRefs` comment in `lib/recipes/schemas.ts`.
- `stepRowsFromRecipe` must receive the exact `ingredients` array assigned to state, never a second `ingredientRowsFromRecipe(recipe)` call: `localId`s are minted once by `nextRowId`, and fresh ones silently break the `sourceId -> localId` lookup (reload path of the step links).
- Stories: `Empty` (create) and `Filled` (edit, `steps[0].ingredientIds` seeded to exercise the reload path) with mocked actions; wrap in `min-h-screen` (a bare static `SidePanel` story crops to a 1280x64 sliver).

## Open
- `docs/open-questions.md#step-rows-no-delete-reorder`
