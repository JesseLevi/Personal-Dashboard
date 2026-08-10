-- #179 (Winkelmand grouping, part 1): shopping_list_items gains a nullable
-- link into reference.ingredients so a row can be grouped by NEVO food
-- group ("Voedingsgroep") on top of #175's existing recipe_id grouping.
--
-- Nullable is deliberate, not a placeholder: the chain that resolves it
-- (recipe_ingredients.ingredient_id -> public.ingredients.reference_id ->
-- reference.ingredients.id) is nullable at every hop, and a manually-typed
-- item (addShoppingListItem) has no recipe_ingredients row at all. A NOT
-- NULL column here would break the RLS fixtures in
-- supabase/tests/rls-shopping_list_items.sql, which insert rows with no
-- reference at all (see docs/incidents.md-class lesson already learned
-- once for a different table).
--
-- on delete set null, same reasoning as recipe_id: this is a provenance /
-- enrichment link, not ownership. Deleting (or re-importing) a
-- reference.ingredients row must never delete a user's shopping list item.
--
-- IMPORTANT: merging this migration does NOT apply it to the hosted
-- database. Per ADR-0012, supabase/migrations/ only reaches production
-- through .github/workflows/deploy.yml's `migrate` job, and that workflow is
-- workflow_dispatch-only — the user must run it explicitly (or apply this
-- migration by hand, ADR-0012 §5).

alter table public.shopping_list_items
  add column reference_ingredient_id uuid references reference.ingredients (id) on delete set null;

comment on column public.shopping_list_items.reference_ingredient_id is
  'Nullable link to reference.ingredients (NEVO food group data), resolved '
  'at send time via recipe_ingredients.ingredient_id -> '
  'public.ingredients.reference_id. Null for manually-typed items or any '
  'ingredient without a library match (#179).';

create index shopping_list_items_reference_ingredient_id_idx
  on public.shopping_list_items (reference_ingredient_id);
