-- Phase 5 slice 1 (#175): shopping_list_items — the Boodschappenlijst /
-- Winkelmand's single table (Architecture §91). Conventions per
-- Architecture §4.1 / ADR-0001 / ADR-0009, same house style as
-- 20260720000001_profiles.sql / 20260730000002_recipe_schema.sql.
--
-- unit reuses public.recipe_unit (created by #130,
-- 20260730000001_ingredient_library.sql) rather than declaring a second unit
-- enum -- tests/recipes-units-enum-sync.test.ts guards this file the same
-- way it already guards recipe_ingredients.unit.
--
-- recipe_id is `on delete set null`, not `cascade`: it is a provenance link
-- ("this item came from recipe X"), not an ownership relationship, so
-- deleting a recipe must never silently empty someone's shopping list
-- (ticket #175, Architecture §91).
--
-- section is stored but rendered by no ticket in this phase: the Winkelmand
-- design (Figma 4044:10838 / 4044:10830) draws one flat card of rows with no
-- section grouping anywhere. The column exists because Architecture §4.2
-- specifies it for future supermarket-section grouping; the gap is logged
-- by slice 3's open question, not re-litigated here.
--
-- position uses the same fractional-positioning scheme as recipes.position /
-- recipe_categories.position (lib/boards/positioning.ts, POSITION_GAP =
-- 1000) -- app/(app)/winkelmand/actions.ts (#176) reuses nextPosition()
-- rather than a second copy of the same math.
--
-- IMPORTANT: merging this migration does NOT apply it to the hosted
-- database. Per ADR-0012, supabase/migrations/ only reaches production
-- through .github/workflows/deploy.yml's `migrate` job, and that workflow is
-- workflow_dispatch-only — the user must run it explicitly (or apply this
-- migration by hand, ADR-0012 §5) before this table exists on the hosted
-- project.

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity is null or quantity > 0),
  -- Reused, not redeclared -- see file header. Nullable, unlike
  -- recipe_ingredients.unit: a manually-typed item ("melk") may carry no
  -- unit at all.
  unit public.recipe_unit,
  checked boolean not null default false,
  -- Supermarket-section grouping (Architecture §4.2). Stored, not rendered
  -- by any ticket yet -- see file header.
  section text,
  -- Provenance link, not ownership -- see file header. Nullable: a
  -- manually-added item has no originating recipe.
  recipe_id uuid references public.recipes (id) on delete set null,
  -- Same fractional-positioning scheme as recipes.position /
  -- recipe_categories.position.
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_list_items is
  'One row per Boodschappenlijst / Winkelmand line (Architecture §91). '
  'recipe_id is a nullable provenance link (on delete set null, never '
  'cascade) -- deleting a recipe must never empty a shopping list. section '
  'is stored for future supermarket grouping but rendered by no ticket in '
  'Phase 5 yet (#175).';

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);
create index shopping_list_items_recipe_id_idx on public.shopping_list_items (recipe_id);

alter table public.shopping_list_items enable row level security;

create policy shopping_list_items_select_own on public.shopping_list_items
  for select using (user_id = (select auth.uid()));
create policy shopping_list_items_insert_own on public.shopping_list_items
  for insert with check (user_id = (select auth.uid()));
create policy shopping_list_items_update_own on public.shopping_list_items
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shopping_list_items_delete_own on public.shopping_list_items
  for delete using (user_id = (select auth.uid()));

-- Table-level grants: this project's Supabase config does not auto-expose
-- new public tables to the API roles -- see 20260720000001_profiles.sql's
-- own grants-block comment. service_role granted too, matching every table
-- migration since 20260724210000_grant_service_role_kanban.sql fixed the
-- same miss for the kanban tables (server/worker code connects as
-- service_role, ADR-0002/0003) -- even though app/(app)/winkelmand/actions.ts
-- (#176) itself uses the anon-key server client and relies on RLS, never
-- service_role, for this table's own CRUD.
grant select, insert, update, delete on public.shopping_list_items to authenticated;
grant select on public.shopping_list_items to anon;
grant select, insert, update, delete on public.shopping_list_items to service_role;
