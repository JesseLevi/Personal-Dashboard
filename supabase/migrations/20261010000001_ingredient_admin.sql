-- #322 (Phase 4, part of #320): admin role helper, shared ingredient aliases
-- and admin write policies on the `reference` ingredient tables.
-- Implements ADR-0020 (docs/decisions/0020-curated-ingredient-mappings-and-admin-role.md)
-- §1, §2 and §4, which amends ADR-0011 §1: NEVO and USDA rows still change
-- only through migrations; an admin may add and edit rows with
-- source = 'eigen' (and shared aliases) through their own RLS-bound client.
--
--   1. public.is_admin(): reads app_metadata.role from the caller's JWT.
--   2. reference.ingredient_aliases: shared alias -> reference ingredient
--      mapping. No user_id (ADR-0011 §1). public.ingredient_aliases (the
--      per-user table) is NOT touched.
--   3. Admin insert/update/delete policies on reference.ingredients and
--      reference.ingredient_unit_masses, limited to source = 'eigen' so the
--      NEVO/USDA rows stay immutable (NEVO licence, ADR-0013).
--
-- Everyone keeps select. RLS alone stands between a non-admin and shared
-- data, so supabase/tests/rls-reference-*.sql are the guard.
-- Same house style as 20260730000001_ingredient_library.sql.

-- ============================================================================
-- 1. public.is_admin() (ADR-0020 §1)
-- ============================================================================

create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

comment on function public.is_admin() is
  'True when the caller''s JWT carries app_metadata.role = ''admin'' '
  '(ADR-0020 §1). app_metadata is not user-writable, so the role cannot be '
  'self-granted. Changes take effect on the next token refresh.';

-- anon gets no EXECUTE (ADR-0009; #304). authenticated needs it because the
-- policies below call it as the invoking role.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ============================================================================
-- 2. reference.ingredient_aliases (ADR-0020 §2)
-- ============================================================================

create table reference.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_normalized text not null unique check (alias_normalized <> ''),
  ingredient_id uuid not null references reference.ingredients (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table reference.ingredient_aliases is
  'Shared, admin-curated alias -> reference.ingredients mapping (ADR-0020 '
  '§2), e.g. "tomaten" -> a specific NEVO tomato row. No user_id: shared '
  'data (ADR-0011 §1). The per-user counterpart is public.ingredient_aliases. '
  'Matching order: own alias, shared alias, pg_trgm, LLM (ADR-0020 §3).';

create trigger ingredient_aliases_set_updated_at
  before update on reference.ingredient_aliases
  for each row execute function public.set_updated_at();

create index ingredient_aliases_ingredient_id_idx
  on reference.ingredient_aliases (ingredient_id);

alter table reference.ingredient_aliases enable row level security;

create policy ingredient_aliases_select_all on reference.ingredient_aliases
  for select using (true);
create policy ingredient_aliases_insert_admin on reference.ingredient_aliases
  for insert to authenticated
  with check ((select public.is_admin()));
create policy ingredient_aliases_update_admin on reference.ingredient_aliases
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy ingredient_aliases_delete_admin on reference.ingredient_aliases
  for delete to authenticated
  using ((select public.is_admin()));

grant select on reference.ingredient_aliases to authenticated, anon;
grant insert, update, delete on reference.ingredient_aliases to authenticated;
grant select, insert, update, delete on reference.ingredient_aliases to service_role;

-- ============================================================================
-- 3. Admin writes on reference.ingredients (ADR-0020 §2, §4)
-- ============================================================================
-- source = 'eigen' in `using` keeps NEVO/USDA rows untouchable (they are not
-- visible to update/delete); in `with check` it stops an admin relabelling a
-- row to or from 'eigen'. Insert only has a with check.

create policy ingredients_insert_admin on reference.ingredients
  for insert to authenticated
  with check ((select public.is_admin()) and source = 'eigen');
create policy ingredients_update_admin on reference.ingredients
  for update to authenticated
  using ((select public.is_admin()) and source = 'eigen')
  with check ((select public.is_admin()) and source = 'eigen');
create policy ingredients_delete_admin on reference.ingredients
  for delete to authenticated
  using ((select public.is_admin()) and source = 'eigen');

grant insert, update, delete on reference.ingredients to authenticated;
grant insert, update, delete on reference.ingredients to service_role;

-- ============================================================================
-- 4. Admin writes on reference.ingredient_unit_masses (ADR-0020 §2)
-- ============================================================================

create policy ingredient_unit_masses_insert_admin on reference.ingredient_unit_masses
  for insert to authenticated
  with check ((select public.is_admin()) and source = 'eigen');
create policy ingredient_unit_masses_update_admin on reference.ingredient_unit_masses
  for update to authenticated
  using ((select public.is_admin()) and source = 'eigen')
  with check ((select public.is_admin()) and source = 'eigen');
create policy ingredient_unit_masses_delete_admin on reference.ingredient_unit_masses
  for delete to authenticated
  using ((select public.is_admin()) and source = 'eigen');

grant insert, update, delete on reference.ingredient_unit_masses to authenticated;
grant insert, update, delete on reference.ingredient_unit_masses to service_role;
