-- #312 (epic #309, ADR-0019): schema for recipe import via URL.
--   a. recipes.source_url / import_status / import_error
--   b. recipe_ingredients.needs_review
--   c. public.ingredient_aliases (user-scoped alias -> ingredient mapping)
--   d. partial index for the lazy sweep of stuck imports
--   e. replace_recipe_contents() round-trips an optional per-line needsReview
--
-- IMPORTANT: merging this migration does NOT apply it to the hosted
-- database (ADR-0012): it only reaches production through deploy.yml's
-- `migrate` job, which the user must dispatch explicitly.

-- ============================================================================
-- recipes: import state
-- ============================================================================

create type public.recipe_import_status as enum ('importing', 'done', 'failed');

alter table public.recipes
  add column source_url text,
  -- Existing rows and every manually created recipe stay 'done'.
  add column import_status public.recipe_import_status not null default 'done',
  -- import_error is a short machine-readable reason code, never user-facing
  -- text (the UI maps it to a next-intl string, ADR-0007). Deliberately no
  -- closed list here: the codes come from typed pipeline errors (safe-fetch,
  -- extraction, rate limit, LLM; ADR-0019 §9) that later tickets add, and a
  -- CHECK list would need a migration for each. Known codes live in
  -- lib/recipes/enums.ts (IMPORT_ERROR_TIMEOUT = 'timeout', set by the lazy
  -- sweep). The checks only enforce shape and the state invariant.
  add column import_error text,
  add constraint recipes_import_error_format
    check (import_error is null or import_error ~ '^[a-z0-9_]{1,64}$'),
  add constraint recipes_import_error_only_when_failed
    check (import_error is null or import_status = 'failed');

comment on column public.recipes.source_url is
  'URL the recipe was imported from (ADR-0019); null for manually created recipes.';
comment on column public.recipes.import_status is
  'importing while the import pipeline runs, done when saved (also every '
  'manual recipe), failed when it errored or the lazy sweep timed it out '
  '(ADR-0019 §1, §9).';
comment on column public.recipes.import_error is
  'Short machine-readable reason code (lowercase snake_case, e.g. ''timeout'') '
  'for a failed import; null unless import_status = ''failed''. Not user-facing.';

-- Lazy sweep (ADR-0019 §1): "this user's importing rows older than 5
-- minutes". Partial, so it stays tiny: almost every row is 'done'.
create index recipes_importing_idx
  on public.recipes (user_id, created_at)
  where import_status = 'importing';

-- ============================================================================
-- recipe_ingredients: needs_review
-- ============================================================================

alter table public.recipe_ingredients
  add column needs_review boolean not null default false;

comment on column public.recipe_ingredients.needs_review is
  'Imported line the parser/matcher was unsure about; flagged in the UI for '
  'the user to confirm (ADR-0019 §8, §9). Manual lines are always false.';

-- ============================================================================
-- ingredient_aliases
-- ============================================================================
-- Maps a normalized free-text name ("bosui") to one of the user's own
-- public.ingredients rows, so the importer's matcher (#316) learns. Mirrors
-- recipe_ingredients.ingredient_id (-> public.ingredients, ADR-0011 §2); NEVO
-- reference data is reached via ingredients.reference_id, not directly.
-- Unlike recipe_ingredients (ownership of ingredient_id is only checked in
-- the server action), the insert/update policies below also require the
-- target ingredient to be the caller's own, so RLS itself rejects an alias to
-- another user's ingredient.

create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Normalized by the app (lowercase, trimmed, diacritics/whitespace folded);
  -- the DB only guards against empty.
  alias_normalized text not null check (alias_normalized <> ''),
  -- An alias is meaningless without its ingredient: cascade.
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Also serves as the (user_id, alias_normalized) lookup index; no separate
  -- index (and none on user_id alone, the unique's leading column covers it).
  unique (user_id, alias_normalized)
);

comment on table public.ingredient_aliases is
  'Per-user alias -> ingredient mapping used by the recipe import matcher '
  '(ADR-0019 §2, #316). alias_normalized is normalized by the app.';

create index ingredient_aliases_ingredient_id_idx on public.ingredient_aliases (ingredient_id);

alter table public.ingredient_aliases enable row level security;

create policy ingredient_aliases_select_own on public.ingredient_aliases
  for select using (user_id = (select auth.uid()));
create policy ingredient_aliases_insert_own on public.ingredient_aliases
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ingredients i
      where i.id = ingredient_id and i.user_id = (select auth.uid())
    )
  );
create policy ingredient_aliases_update_own on public.ingredient_aliases
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ingredients i
      where i.id = ingredient_id and i.user_id = (select auth.uid())
    )
  );
create policy ingredient_aliases_delete_own on public.ingredient_aliases
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ingredient_aliases to authenticated;
grant select on public.ingredient_aliases to anon;
grant select, insert, update, delete on public.ingredient_aliases to service_role;

-- ============================================================================
-- replace_recipe_contents: round-trip needs_review
-- ============================================================================
-- Same signature as 20260802000001_recipe_step_ingredients.sql, so
-- `create or replace` keeps the existing grants (authenticated, service_role;
-- #304) and the comment. Only change: each p_ingredients element may carry
-- "needsReview": boolean; absent or null means false, so existing callers
-- are unaffected. Still security invoker, search_path = ''.

create or replace function public.replace_recipe_contents(
  p_recipe_id uuid,
  p_ingredients jsonb,
  p_steps jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_ingredient_count int;
  v_ingredient_ids uuid[] := array[]::uuid[];
  v_step_count int;
  v_element jsonb;
  v_id uuid;
  v_refs jsonb;
  v_ref_count int;
  v_ref_val int;
  i int;
  j int;
begin
  select user_id into v_owner
  from public.recipes
  where id = p_recipe_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'recipe % not found or not owned by the caller', p_recipe_id;
  end if;

  delete from public.recipe_ingredients where recipe_id = p_recipe_id;
  delete from public.recipe_steps where recipe_id = p_recipe_id;

  v_ingredient_count := coalesce(jsonb_array_length(p_ingredients), 0);
  for i in 0 .. v_ingredient_count - 1 loop
    v_element := p_ingredients -> i;
    v_id := gen_random_uuid();
    v_ingredient_ids := v_ingredient_ids || v_id;

    insert into public.recipe_ingredients (
      id, user_id, recipe_id, ingredient_id, name, quantity, unit, position,
      group_label, needs_review
    ) values (
      v_id,
      v_owner,
      p_recipe_id,
      (v_element ->> 'ingredientId')::uuid,
      v_element ->> 'name',
      (v_element ->> 'quantity')::numeric,
      (v_element ->> 'unit')::public.recipe_unit,
      (i + 1) * 1000,
      v_element ->> 'groupLabel',
      coalesce((v_element ->> 'needsReview')::boolean, false)
    );
  end loop;

  v_step_count := coalesce(jsonb_array_length(p_steps), 0);
  for i in 0 .. v_step_count - 1 loop
    v_element := p_steps -> i;
    v_id := gen_random_uuid();

    insert into public.recipe_steps (id, user_id, recipe_id, position, instruction)
    values (v_id, v_owner, p_recipe_id, (i + 1) * 1000, v_element ->> 'instruction');

    v_refs := coalesce(v_element -> 'ingredientRefs', '[]'::jsonb);
    v_ref_count := coalesce(jsonb_array_length(v_refs), 0);
    for j in 0 .. v_ref_count - 1 loop
      v_ref_val := (v_refs ->> j)::int;
      if v_ref_val is not null and v_ref_val >= 0 and v_ref_val < v_ingredient_count then
        insert into public.recipe_step_ingredients (
          user_id, step_id, recipe_ingredient_id, position
        ) values (
          v_owner,
          v_id,
          v_ingredient_ids[v_ref_val + 1],
          (j + 1) * 1000
        );
      end if;
    end loop;
  end loop;
end;
$$;
