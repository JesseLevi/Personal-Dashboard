# IngredientAdminPage

- **Code:** `app/(app)/recepten/ingredienten/` (`page.tsx`, `IngredientAdmin.tsx`, `AliasPanel.tsx`, `OwnIngredientPanel.tsx`, `actions.ts`, stories beside them); data in `lib/recipes/ingredient-admin.ts`, validation in `lib/recipes/ingredient-admin-schemas.ts`.
- **Origin:** Claude-designed on request (#325, user 2026-10-10). No Figma node exists; ADR-0020 §2, §4, §6 is the spec.

## Composition (existing pieces only, no new tokens)

- `PageHeader` with one "add" action that follows the active tab.
- `ButtonToggle` as the tab switch (Koppelingen / Eigen ingrediënten), `InputField` search, `Card` + a local `ListRow` (button, `Tag` badge, `stroke-lines` divider as a sibling like `CardContentIngredient`).
- Create/edit in `SidePanel`: mobile = bottom sheet over the list, desktop (`md:`) = 400 px right drawer with the list still visible beside it. The scrim dims the list while the drawer is open, which is `SidePanel`'s own behaviour; a non-modal "true side by side" variant would be a new SidePanel mode and was not built.
- Delete reuses `DeleteConfirm` (stacked) with the ADR-0020 §4 wording: detaches users' rows, removes aliases.
- Tokens: `surface-highlight-white(-hover/-active)`, `stroke-lines`, `text-primary/secondary`, `text-highlight-green`, `priority-urgent` (errors), `Tag` variant `highlight` for the "Eigen" label (NEVO licence, ADR-0013: `eigen` rows are always labelled).

## Decisions and deviations

- **Alias target picker is not `IngredientSearchPanel`.** That panel is a multi-select that materialises per-user `public.ingredients` rows on save (`onCreateOwnIngredient`), which is the wrong side effect for a shared alias. `AliasPanel` reuses the same `searchIngredients` action, the same `CardContentIngredient` rows and `resultDisplayName`, but single-select and only `reference` rows (NEVO or eigen); a user's own rows are filtered out.
- `CardContentIngredient` dims a checked row to 40 %; the picked row therefore looks dimmed, as in the existing search panel. A "Gekozen: ..." line above the results states the choice in full contrast.
- The alias key is shown as "Opgeslagen als: ..." (live `normalizeIngredientName`), because the typed name is never stored. The edit form starts from the stored key for the same reason.
- The second tab is labelled "Eigen" (not "Eigen ingrediënten"): the full label wrapped to two lines in `ButtonToggle` at 375 px. The notice under the tabs says "Eigen ingrediënten ...". The toggle is capped at `md:max-w-sm` so it does not stretch across the desktop column.
- Content column is `md:max-w-3xl`; there is no responsive Figma frame to measure against.
- Nutrient fields are text inputs with `inputMode="decimal"` (comma accepted); empty means `null`, never `0`. Weight per unit offers only non-mass units.
- `source_version` of an `eigen` row is the ISO date of its last edit.
- Only RLS-bound clients are used; every action also checks `isAdmin()` and answers `forbidden` otherwise (`recipes.errors.forbidden`). `duplicate` is the unique-key clash on `alias_normalized`.
- Types: `lib/database.types.ts` already carried the #322 `reference` tables, so no cast was needed.

## Not here

"Nog te koppelen" (#326).
