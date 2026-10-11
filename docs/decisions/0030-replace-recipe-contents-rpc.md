# ADR-0030: `replace_recipe_contents` — the first RPC and the transactional replace pattern

**Status**: Proposed (retroactive; the underlying choice was approved by the user 2026-08-01, issue #149)

**Authored by**: Claude Code (Opus 5.5), at the instruction of ticket #292, as a retroactive write-up. Same provenance caveat as ADR-0011/0013/0014: this is not the architecture layer's own output. The choice below is already shipped and was approved by the user at the time; what is **proposed** here is the written record, for the architecture layer to accept, amend or reject.

**Overlap**: ADR-0015 already cites this function as the precedent for `move_card`/`move_recipe` and records the standing "atomic multi-step write → RPC" pattern. This ADR records the *origin* decision and the replace-shaped specifics; it does not restate ADR-0015.

## Context

`createRecipe`/`updateRecipe` (`app/(app)/recepten/actions.ts`) wrote ingredients and steps as delete-then-insert pairs through PostgREST: sequential, non-atomic statements, an accepted and documented trade-off since #126. A failed insert after a successful delete could leave a recipe with **no** ingredients or steps, and `updateRecipe` had no compensation (`design/notes/RecipePanel.md`). #149 added a third table to that write (ADR-0029), widening the partial-failure window. The user approved introducing the repo's first Postgres function on 2026-08-01.

## Decision

`public.replace_recipe_contents(p_recipe_id uuid, p_ingredients jsonb, p_steps jsonb) returns void`:

- **One function body = one transaction**: check ownership, delete the recipe's ingredients and steps (step links cascade), insert ingredients (new ids, `position` = (i+1)×1000), insert steps, insert step links from `ingredientRefs`.
- `security invoker` (never `definer`): RLS governs every statement as if the caller had issued it. `set search_path = ''`, everything schema-qualified.
- An **explicit ownership guard** on top of RLS (raises if the recipe is not the caller's): the function is reachable directly via PostgREST by any authenticated caller, so Zod validation in `lib/recipes/schemas.ts` cannot be the only line of defence.
- `revoke execute ... from public`; grant to `authenticated, service_role` only.
- A JSON payload of ordered arrays (array index = position), with step→ingredient refs as 0-based indexes.
- Tested in `supabase/tests/rls-recipe_step_ingredients.sql` (a foreign recipe is refused).

## Consequences

- Recipe writes are atomic and cost one round trip; the "no ingredients after a failed update" risk is closed.
- **Replace, not diff**: every save deletes and recreates all ingredient and step rows, so row ids and `created_at` do not survive an edit. Cheap at recipe size; unsuitable if anything needs stable ids (see ADR-0029).
- Recipe-write logic lives in two places, TypeScript validation and SQL, kept in sync by hand; the function signature in `lib/database.types.ts` is likewise maintained to match (ADR-0015 consequence).
- Errors are a plain raised exception, unlike the later RPCs' custom SQLSTATEs (`MV404`, ADR-0015). Left as is.
- Established the pattern reused by `move_card`, `move_recipe`, `move_note` and (via #286) `toggle_board_favorite` (ADR-0015, ADR-0026); `docs/guides/data-layer.md` states it as a rule.
- Delivery to hosted follows ADR-0012.

## Migration

- [`supabase/migrations/20260802000001_recipe_step_ingredients.sql`](../../supabase/migrations/20260802000001_recipe_step_ingredients.sql) (#149, commit `2b71d2b`) — function defined after the join table.
