# PasAanPanel
Figma: `Recept/Mobile/PasAan/Dropdown` `3997:25600` (pull-up panel `3998:10701`) / `Recept/Desktop/PasAan/Dropdown` `3999:10604` (slide-in panel `3999:10877`) · Code: `app/(app)/recepten/[recipeId]/PasAanPanel.tsx`

## Anatomy
Page-level composition reusing `SidePanel` as-is (its responsive pull-up/slide-in is the "Slides in from right" annotation); not a mapped Figma component, no `figma-map.json` entry (same precedent as `RecipePanel`/`CategoryPanel`). Content is a titled `Card` ("Ingrediënten", inner card `3998:10928`) with two rows: Personen (`PortionStepper`) and Eenheid (button + popover with US/Metric options). Both rows are Figma's Card-content/Ingredient template text-swapped. Footer: one "Opslaan" button. Field reasoning (Personen control, dropped "Verwijderen", session-only draft) lives in `design/notes/RecipeDetailPage.md`.

## Deliberate decisions
- Draft state resets to the applied `portions`/`unitSystem` on every open; X, overlay, Escape and drag-to-close only call `onClose`, never `onApply`. (#160)
- The Eenheid popover uses `lib/dom/use-popover-position.ts` with `anchor="right"`, `prefer="below"`. On mobile `SidePanel`'s bottom sheet hugs its content and Eenheid is the last row, so a fixed `mt-2` offset landed behind the Opslaan footer; the hook flips it above when below does not fit inside the scroll container. `position: fixed` was ruled out because `translate` creates a containing block (mechanism: `docs/incidents.md`, 2026-08-18).

## Token gaps and flags
- Row `gap-5`/`py-3`/`pl-3`/`pr-3` -> `gap-inline-xl` (`spacing/inline/gap-xl`, 20px) and `py/pl/pr-component-md` (`spacing/component/padding-md`, 12px); identical px, bound on both template instances (`I3998:10928;3997:25437;3998:10985` / `...;3998:11031`). (#219)
- The open Eenheid popover has no Figma node (mockups show only the collapsed "Amerikaans" button), so the popover has no measured offsets or width (`w-40` is code-chosen).
- Figma's reused Card instance title reads "Dry" (template leftover); the code renders `t("ingredientsCardTitle")` ("Ingrediënten") regardless.
