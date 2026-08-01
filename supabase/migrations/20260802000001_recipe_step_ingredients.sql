-- #149: "Add Recipi feedback" — links each recipe_steps row to a subset of
-- its own recipe's recipe_ingredients rows (Figma node 3749:3091, the
-- picker; 3778:5467, the detail rendering already supported by
-- CardContentStep.tsx's `children` slot). Two things in one migration:
--   a. public.recipe_step_ingredients — the step<->ingredient join table.
--   b. public.replace_recipe_contents(...) — this repo's first RPC, giving
--      the recipe write path (app/(app)/recepten/actions.ts) a real
--      Postgres transaction across recipe_ingredients + recipe_steps +
--      recipe_step_ingredients (previously two sequential delete/insert
--      statement pairs — see actions.ts's updated header comment).
--
-- Deviation from Architecture.md §4.2, approved by the user (2026-08-01,
-- issue #149) but not yet folded back into Architecture.md / an ADR — that
-- write-up is Fable's job, not Claude Code's (docs/guides/ticket-workflow.md).
-- Unlike recipe_tags (20260730000002_recipe_schema.sql), ADR-0001 carries no
-- blanket join-table exception here either: recipe_step_ingredients gets its
-- own user_id, same precedent as recipe_tags/card_labels.
--
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009, same house style
-- as 20260730000002_recipe_schema.sql.

-- ============================================================================
-- recipe_step_ingredients
-- ============================================================================

create table public.recipe_step_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  step_id uuid not null references public.recipe_steps (id) on delete cascade,
  recipe_ingredient_id uuid not null references public.recipe_ingredients (id) on delete cascade,
  -- Same fractional-positioning scheme as recipe_ingredients.position /
  -- recipe_steps.position — the order the linked ingredients render as Tags
  -- under a step (Figma 3778:5467).
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (step_id, recipe_ingredient_id)
);

comment on table public.recipe_step_ingredients is
  'Step <-> ingredient join table (#149): which of a recipe''s own '
  'recipe_ingredients rows a given recipe_steps row references, rendered as '
  'Tags on the recipe detail page (Figma 3778:5467). Carries its own '
  'user_id per the file-header note (no ADR-0001 join-table exception). '
  'Deviation from Architecture.md §4.2, owed an ADR — see file header.';

create trigger recipe_step_ingredients_set_updated_at
  before update on public.recipe_step_ingredients
  for each row execute function public.set_updated_at();

create index recipe_step_ingredients_user_id_idx on public.recipe_step_ingredients (user_id);
create index recipe_step_ingredients_step_id_idx on public.recipe_step_ingredients (step_id);
create index recipe_step_ingredients_recipe_ingredient_id_idx
  on public.recipe_step_ingredients (recipe_ingredient_id);

alter table public.recipe_step_ingredients enable row level security;

create policy recipe_step_ingredients_select_own on public.recipe_step_ingredients
  for select using (user_id = (select auth.uid()));
create policy recipe_step_ingredients_insert_own on public.recipe_step_ingredients
  for insert with check (user_id = (select auth.uid()));
create policy recipe_step_ingredients_update_own on public.recipe_step_ingredients
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_step_ingredients_delete_own on public.recipe_step_ingredients
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_step_ingredients to authenticated;
grant select on public.recipe_step_ingredients to anon;
grant select, insert, update, delete on public.recipe_step_ingredients to service_role;

-- ============================================================================
-- public.replace_recipe_contents(p_recipe_id, p_ingredients, p_steps)
-- ============================================================================
-- This repo's first RPC (user-approved 2026-08-01, issue #149), specifically
-- to get a real Postgres transaction across the replace-in-transaction write
-- that app/(app)/recepten/actions.ts's createRecipe/updateRecipe already
-- documented as a two-statement, non-atomic trade-off (see that file's
-- header comment, now rewritten). `security invoker` (never `security
-- definer`, unlike seed_default_recipe_categories() above — that trigger
-- fires with elevated privilege on auth.users by necessity, this function
-- does not need to and must stay governed by the caller's own RLS on every
-- statement) + `set search_path = ''` so every reference below is
-- schema-qualified and cannot be hijacked by a search_path trick.
--
-- Element shapes (validated shape/format-wise by lib/recipes/schemas.ts
-- before this is ever called from app/(app)/recepten/actions.ts; this
-- function itself only re-checks recipe ownership, not full input shape,
-- because it's reachable directly via PostgREST by any authenticated caller,
-- same "RLS is belt-and-braces, keep the explicit check anyway" convention
-- every action in that file already uses for a client-supplied id):
--   p_ingredients: [{"name": text, "quantity": number|null,
--                    "unit": text (public.recipe_unit), "ingredientId":
--                    uuid|null, "groupLabel": text|null}, ...]
--   p_steps:       [{"instruction": text, "ingredientRefs": [0, 2, ...]}]
--     -- ingredientRefs are 0-based indexes into p_ingredients; an
--     -- out-of-range index is silently skipped, not raised, so a client
--     -- that races a step-ingredient edit against an ingredient removal in
--     -- the same payload degrades gracefully instead of failing the whole
--     -- write.
create function public.replace_recipe_contents(
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
  -- Ownership guard: RLS on public.recipes already scopes this select to
  -- the caller, so a mismatched/nonexistent recipe simply returns no row --
  -- kept explicit anyway, same "don't trust the client for ownership"
  -- convention app/(app)/recepten/actions.ts already applies at the action
  -- layer, now duplicated here because this function is the actual
  -- transaction boundary and reachable directly via PostgREST.
  select user_id into v_owner
  from public.recipes
  where id = p_recipe_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'recipe % not found or not owned by the caller', p_recipe_id;
  end if;

  delete from public.recipe_ingredients where recipe_id = p_recipe_id;
  -- recipe_step_ingredients rows cascade away with their recipe_steps row
  -- (on delete cascade, both FKs above) -- no separate delete needed here.
  delete from public.recipe_steps where recipe_id = p_recipe_id;

  -- gen_random_uuid() is unqualified but still resolves under
  -- `search_path = ''`: pg_catalog is always implicitly searched regardless
  -- of search_path, and gen_random_uuid() has been a pg_catalog built-in
  -- since Postgres 13 (no pgcrypto/extensions-schema dependency).
  v_ingredient_count := coalesce(jsonb_array_length(p_ingredients), 0);
  for i in 0 .. v_ingredient_count - 1 loop
    v_element := p_ingredients -> i;
    v_id := gen_random_uuid();
    v_ingredient_ids := v_ingredient_ids || v_id;

    insert into public.recipe_ingredients (
      id, user_id, recipe_id, ingredient_id, name, quantity, unit, position, group_label
    ) values (
      v_id,
      v_owner,
      p_recipe_id,
      (v_element ->> 'ingredientId')::uuid,
      v_element ->> 'name',
      (v_element ->> 'quantity')::numeric,
      (v_element ->> 'unit')::public.recipe_unit,
      (i + 1) * 1000,
      v_element ->> 'groupLabel'
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
      -- Silently skip an out-of-range index (see the function-header note)
      -- rather than raising.
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

comment on function public.replace_recipe_contents is
  'Replaces every recipe_ingredients/recipe_steps/recipe_step_ingredients '
  'row for p_recipe_id with p_ingredients/p_steps, in one real transaction '
  '(#149). security invoker: RLS governs every statement, same as if the '
  'caller had issued them directly.';

-- Postgres grants EXECUTE on every new function to the PUBLIC pseudo-role by
-- default -- revoke that first, same "grants are the real boundary here,
-- don't rely on an implicit default" reasoning as the table grants above.
revoke execute on function public.replace_recipe_contents(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_recipe_contents(uuid, jsonb, jsonb)
  to authenticated, service_role;
