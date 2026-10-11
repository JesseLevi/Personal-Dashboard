# ADR-0028: `public.recipe_unit` — one Postgres enum for every unit column

**Status**: Accepted (retroactive record; the underlying choice was approved by the user 2026-07-29, issues #119/#120/#130; ratified 2026-10-11, #412)


**Overlap**: ADR-0011 §3 decides per-ingredient mass per unit (lookup, user → reference → unresolved) and ADR-0014 amends it to allow volume↔mass conversion; both consume this enum but neither records why the enum exists or why one is shared. This ADR covers only the type. Conversion semantics stay in ADR-0011/0014.

## Context

`Architecture.md` §4.2 has `recipe_ingredients.unit` as nullable free text. On 2026-07-29 the user decided units come from a fixed dropdown, not free text (ADR-0011 context point 1: free-text units make conversion silently unreliable). The canonical list lives in `lib/recipes/units.ts` (#120): 17 codes, metric *and* imperial from day one so an American recipe can be typed in cups/tsp verbatim — gram, kilogram, ounce, pound, milliliter, deciliter, liter, theelepel, eetlepel, cup, teaspoon, tablespoon, fluid_ounce, stuk, snufje, scoop, naar_smaak. Figma only draws Gram, Kilogram, Liter, Scoop ("etc."); the rest is a user decision, not a design fact (`docs/open-questions.md`, `unit-dropdown-list-not-drawn`).

## Decision

- A single enum **`public.recipe_unit`** whose values equal `UNIT_CODES` exactly.
- It is created in the **ingredient-library migration (#130)**, not the recipe-schema migration (#119): both `ingredient_unit_masses` tables need the type first, and #119 already depends on #130 for the `ingredient_id` FK target — the only dependency order without a cycle. #119 reuses the type rather than declaring a second one.
- It is reused by every unit column: `reference.ingredient_unit_masses.unit`, `public.ingredient_unit_masses.unit`, `recipe_ingredients.unit` (`not null`, a deviation from §4.2's nullable; "naar smaak" is the explicit `naar_smaak` value), and `shopping_list_items.unit` (nullable there).
- TypeScript and SQL are kept in step by a **tripwire test**, `tests/recipes-units-enum-sync.test.ts`, which parses `supabase/migrations/` for `create type ... unit ... as enum` and asserts equality with `UNIT_CODES`, failing loudly on a declaration shape it cannot parse. `lib/database.types.ts` was hand-written when this was decided, so a type-level comparison was not possible.

## Consequences

- Adding a unit is cheap (`alter type ... add value`, plus `UNIT_CODES` and the nl/en labels); **removing or renaming one is expensive** once recipes, masses and shopping rows reference it. The tickets instruct starting conservatively and never deviating silently. No `alter type` has been needed so far.
- One type across recipes, masses and the shopping list keeps merges and joins type-safe and prevents a second, drifting unit vocabulary.
- Imports can only map to units in the enum (ADR-0013: only `eetlepel`, `theelepel`, `stuk` overlap with NEVO's `Maat`).
- **Not recoverable**: why an enum rather than a lookup table or text+check (the pattern used for `cards.size`, ADR-0025). The tickets state only "Postgres-enum in plaats van vrije text"; the trade-off against alternatives was not written down.
- `Architecture.md` §4 reflects this since #412.

## Migration

- [`supabase/migrations/20260730000001_ingredient_library.sql`](../../supabase/migrations/20260730000001_ingredient_library.sql) (#130, commit `c48d047`) — creates the type.
- [`supabase/migrations/20260730000002_recipe_schema.sql`](../../supabase/migrations/20260730000002_recipe_schema.sql) — `recipe_ingredients.unit` (deviation c).
- [`supabase/migrations/20260808000001_shopping_list_items.sql`](../../supabase/migrations/20260808000001_shopping_list_items.sql) — reuse in the shopping list.
