# ADR-0029: `recipe_step_ingredients` — linking steps to ingredients

**Status**: Proposed (retroactive; the underlying choice was approved by the user 2026-08-01, issue #149)

**Authored by**: Claude Code (Opus 5.5), at the instruction of ticket #292, as a retroactive write-up. Same provenance caveat as ADR-0011/0013/0014: this is not the architecture layer's own output. The choice below is already shipped and was approved by the user at the time; what is **proposed** here is the written record, for the architecture layer to accept, amend or reject.

## Context

`Architecture.md` §4.2 has `recipe_steps` and `recipe_ingredients` with no relation between them. Issue #149 describes the flow: after entering ingredients, the user writes a step and opens a pull-up panel listing only that recipe's ingredients (Figma `3749:3091`) to pick which ones the step uses; the recipe detail page then shows, under each step, its instruction plus the linked ingredients with quantity and unit (`3778:5467`, already supported by `CardContentStep`'s `children` slot).

## Decision

A join table `public.recipe_step_ingredients (step_id → recipe_steps, recipe_ingredient_id → recipe_ingredients, position numeric)`, `unique (step_id, recipe_ingredient_id)`, both FKs `on delete cascade`.

- It carries its **own `user_id`** and the four standard RLS policies: ADR-0001 has no join-table exception (same precedent as `card_labels`, `recipe_tags`). RLS test: `supabase/tests/rls-recipe_step_ingredients.sql` (ADR-0009).
- It links to **`recipe_ingredients` rows of the same recipe**, not to `public.ingredients`: the step must show *this recipe's* quantity and unit, and a recipe line may have no library link at all (ADR-0011 §2).
- `position` uses the repo's fractional scheme and orders the linked ingredient Tags under a step.
- The write path is the `replace_recipe_contents` RPC (ADR-0030): the client cannot know row ids of a not-yet-saved recipe, so it sends 0-based `ingredientRefs` indexes into the ingredient array and the RPC resolves them (`design/notes/StepIngredientPanel.md`).

## Consequences

- Cascade means deleting an ingredient silently drops its step links, and deleting a step drops its links.
- Because the RPC replaces ingredients wholesale (new ids each save), `recipe_ingredients.id` is **not stable across edits** and links are rebuilt on every save. Any future table that stores a `recipe_ingredients.id` long-term must account for that.
- An out-of-range `ingredientRef` is skipped silently, not raised, so a client racing a link edit against an ingredient removal degrades gracefully instead of failing the whole write.
- Alternatives (an id-array column on `recipe_steps`, free-text mentions) are **not recorded** in the ticket or migration; the join table follows the existing `card_labels`/`recipe_tags` shape. Why the alternatives were rejected is not recoverable.
- `Architecture.md` §4.2 is stale.

## Migration

- [`supabase/migrations/20260802000001_recipe_step_ingredients.sql`](../../supabase/migrations/20260802000001_recipe_step_ingredients.sql) (#149, commit `2b71d2b`) — table, policies, grants; the same file defines the RPC of ADR-0030.
