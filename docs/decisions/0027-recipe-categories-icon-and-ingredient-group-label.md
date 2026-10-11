# ADR-0027: `recipe_categories.icon` and `recipe_ingredients.group_label`

**Status**: Proposed (retroactive; the underlying choices were approved by the user 2026-07-29/30, issue #119)

**Authored by**: Claude Code (Opus 5.5), at the instruction of ticket #292, as a retroactive write-up. Same provenance caveat as ADR-0011/0013/0014: this is not the architecture layer's own output. The choices below are already shipped and were approved by the user at the time; what is **proposed** here is the written record, for the architecture layer to accept, amend or reject.

**Grouped** because both are small additive columns that exist only because the Figma design draws something `Architecture.md` §4.2 has no field for, both were listed together as deviations (a) and (b) in #119, and neither has a rationale beyond "the design shows it". Two separate ADRs would be near-identical.

## Context

§4.2 lists `recipe_categories` as (name, position) and `recipe_ingredients` as (recipe_id, name, quantity, unit, position).

- The recipe overview (Figma `3761:5537`) shows an icon next to each category column's name and count (Ontbijt = Croissant, Lunch = Sandwich, Avond = Broccoli) — the same pattern as `board_columns.icon` on Kanban.
- The recipe detail page (`3778:3792`) shows named ingredient sections ("Wet", "Dry") as separate `Card` instances (stacked on mobile `3778:5437`, side by side on desktop `3778:5600`).

## Decision

1. **`recipe_categories.icon text not null`** — a member of the `IconName` union in `components/atoms/Icon.tsx`, PascalCase (e.g. `Croissant`), same convention as `board_columns.icon`. Plain text, not an enum or FK. The three default categories are seeded per user by `seed_default_recipe_categories()`, mirroring the Kanban seed trigger; `20260731212646_backfill_recipe_categories.sql` backfills accounts that predate the trigger.
2. **`recipe_ingredients.group_label text` (nullable)** — one nullable column on the ingredient row; **no** separate `recipe_ingredient_groups` table. The ticket's reasoning: the design has no UI to *manage* groups, only to display them, so a table would model behaviour nobody can reach. Ingredients sharing a label render in one `Card`; unlabelled ones render under a default "Ingrediënten" heading (`design/notes/RecipeDetailPage.md`, reversed in #166). The replace RPC (ADR-0030) writes it from `groupLabel`.

## Consequences

- `icon` is not validated against `IconName` by the database. That `IconName` is the right set is enforced application-side; the same free-text-vs-union gap is already noted for `board_columns.icon` in `design/notes/TeDoenBoard.md` (render-time guard `isIconName`).
- A group is a string repeated across rows: renaming a group rewrites every row in it, a typo creates a new group, and a group cannot carry its own ordering or metadata. Accepted as the price of not building a table with no UI. If group management is ever designed, extracting a table needs a migration and a new ADR.
- Group order is derived from ingredient `position`, not stored.
- Why `icon` is `text` rather than something constrained: not recorded beyond "same as `board_columns.icon`".
- `Architecture.md` §4.2 is stale on both columns.

## Migration

- [`supabase/migrations/20260730000002_recipe_schema.sql`](../../supabase/migrations/20260730000002_recipe_schema.sql) (#119, commit `4bdf568`) — deviations (a) and (b) in its file header.
- [`supabase/migrations/20260731212646_backfill_recipe_categories.sql`](../../supabase/migrations/20260731212646_backfill_recipe_categories.sql) — seeding for existing accounts.
