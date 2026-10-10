# IngredientAdminPage

- **Code:** `app/(app)/recepten/ingredienten/` (`page.tsx`, `IngredientAdmin.tsx`, `AliasPanel.tsx`, `OwnIngredientPanel.tsx`, `actions.ts`, stories beside them); data in `lib/recipes/ingredient-admin.ts`, validation in `lib/recipes/ingredient-admin-schemas.ts`.
- **Origin:** Claude-designed on request (#325, user 2026-10-10). No Figma node exists; ADR-0020 §2, §4, §6 is the spec.

## Composition (#350 redesign, existing pieces only, no new tokens)

Claude-designed on request (#325, redesigned #350: the first version read as a different product). Mirrors Winkelmand's rhythm: one `surface-primary` plane, content in `pr-page-right-equal`, no boxed list.

- `PageHeader` with exactly one filled "add" button (follows the active section). `ButtonToggle` as the section switch, full label "Eigen ingrediënten" from `md:` up and the short "Eigen" below it (`useIsDesktop`, because `ButtonToggle` labels are strings; user decision on #350) (`w-full` on mobile, `md:max-w-md` on desktop; hugging via `w-fit` wraps because the segments are `basis-0`). `InputField` search below it.
- One muted `text-base text-text-secondary` count line above the list ("12 koppelingen", "2 van 12" while searching) replaces the two explainer paragraphs.
- Plain rows: a local `ListRow` button (`rounded-control`, `px/py-component-md`, `hover:bg-surface-secondary`, `active:bg-surface-secondary-hover`, as the Sidebar rows), semibold truncating primary line, muted truncating secondary line, `stroke-lines` divider as a sibling between rows (like `CardContentIngredient`). No `Card`.
- The "Eigen" mark (ADR-0013, `eigen` rows always labelled) is small muted text, no `Tag` chip, shown on every row of the Eigen section too.
- No chevron: `ChevronRight` is not in the `Icon` set and adding an icon is out of scope. Hover/active state only.
- Empty / no-results: one centred muted line (`py-stack-xxl`), no card, no button (the header button is the action). The route has no own `loading.tsx`; `recepten/loading.tsx` (header-only skeleton) covers it.
- Panels stay in `SidePanel`: mobile bottom sheet, desktop 400 px drawer with scrim. Kept deliberately: every other edit form (RecipePanel, Te doen AddItem, IngredientSearchPanel) uses this drawer, and a non-modal mode or centred modal would be a new primitive. Therefore the list is dimmed while editing; #325's "list stays readable" is met only as far as the drawer leaves it visible.
- `PanelSection.tsx` holds the visible `PanelTitle` (`text-xl font-semibold`, `aria-hidden`; `SidePanel`'s sr-only h2 names the dialog) and `PanelSection` (semibold heading, optional muted hint). Own panel: Namen, Voeding per 100 g (2-col grid), Gewicht per eenheid (unit + grams side by side). Alias panel: Naam in recept, Gekoppeld ingrediënt.
- Footer: filled "Opslaan" grows; edit mode adds the destructive "Verwijderen" to its left. `DeleteConfirm` flow and wording are unchanged. Not changed to a separated bottom link because `SidePanel`'s footer is a single strip.
- Tokens: `surface-primary`, `surface-secondary(-hover)`, `stroke-lines`, `text-primary/secondary`, `text-highlight-green`, `priority-urgent`, spacing `component-md`, `stack-*`, `inline-*`, `page-right-equal`, radius `control`.
- Stories sit on `bg-surface-primary` like the app shell's `main` (Ladle's own body is white, so the header strip looked grey on white before).

## Decisions kept from #325

- **Alias target picker is not `IngredientSearchPanel`.** That panel is a multi-select that materialises per-user `public.ingredients` rows on save (`onCreateOwnIngredient`), which is the wrong side effect for a shared alias. `AliasPanel` reuses `searchIngredients`, `CardContentIngredient` rows and `resultDisplayName`, single-select and only `reference` rows; a user's own rows are filtered out.
- `CardContentIngredient` dims a checked row to 40 %; a "Gekozen: ..." line states the choice in full contrast.
- The alias key is shown as "Opgeslagen als: ..." (live `normalizeIngredientName`); the edit form starts from the stored key.
- Nutrient fields are text inputs with `inputMode="decimal"`; empty means `null`, never `0`. Weight per unit offers only non-mass units.
- `source_version` of an `eigen` row is the ISO date of its last edit.
- Only RLS-bound clients; every action also checks `isAdmin()`. `duplicate` is the unique-key clash on `alias_normalized`.

## Open

- "Eigen ingrediënten" wraps to two lines at 375 px (each segment gets about 157 px), so mobile shows "Eigen" (user decision). Desktop drawer keeps its scrim: accepted by the user as consistent with the other panels.

## Nog te koppelen (#326)

Claude-designed on request (#326); existing pieces only, no new tokens. Code: `PendingPanel.tsx`, `linkPendingGroup` in `actions.ts`, `getPendingIngredientGroups` in `lib/recipes/ingredient-admin.ts`.

- Third `ButtonToggle` segment (icon `List`). Three segments do not fit at 375 px with the long labels, so below `md:` all three are short ("Alias", "Eigen", "Open"; "To link" in en), from `md:` the full "Koppelingen", "Eigen ingrediënten", "Nog te koppelen". The toggle is `w-full` (640 px column) so the long labels stay on one line. The header "add" button is hidden on this tab: rows are the action, so there is still one primary action per view.
- Same `ListRow`: primary = most common spelling, secondary = "N regels in je recepten". Tap opens `PendingPanel` (`SidePanel`): link target search (copy of `AliasPanel`'s single-select reference-only picker), optional "Gewicht per eenheid" (unit + grams, as in `OwnIngredientPanel`), one filled "Koppelen" footer button.
- Data: the admin's own `recipe_ingredients` (`needs_review` or no `ingredient_id`), read with the user's RLS client plus an explicit `user_id` filter, grouped by `normalizeIngredientName` (which singularises: "tomaten" groups as "tomaat"). No SQL, no migration, no cross-user data.
- `linkPendingGroup` order: optional `eigen` unit mass (delete + insert of that (ingredient, unit) eigen row), shared alias insert, `resolveIngredientId` (adopt the reference row as the admin's own ingredient), then update the admin's lines with that normalised name (`ingredient_id`, `needs_review = false`). An existing alias for the same key is reused when it points at the same ingredient; one pointing elsewhere returns `duplicate` before lines change. Not atomic across steps, but every step is idempotent, so a retry repairs a partial run.
- A unique (ingredient, unit) clash with a NEVO mass row returns `unit-mass-exists`.
- Lines deliberately kept as plain names (ADR-0020 §5, `ingredient_id = null`) also appear here until linked.
- Tests: `tests/recipes-pending-groups.test.ts` (a second user's lines are present in the fake).
