-- Phase 4 (#130): ingredient library — a `reference` schema for shared,
-- non-user ingredient data, its per-user `public` counterpart, the shared
-- `public.recipe_unit` enum, and a hand-curated Dutch seed.
-- Implements ADR-0011 (docs/decisions/0011-ingredient-library-and-reference-data.md)
-- §1-§3, §5, §6. That ADR is binding; this migration only executes it.
--
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009, same house style
-- as 20260720000001_profiles.sql / 20260723000001_kanban_schema.sql.
--
-- Coordination note for #119 (recorded in ADR-0011 §3 and the #130 ticket
-- body): the `public.recipe_unit` enum below is created HERE, not in #119,
-- because both `ingredient_unit_masses` tables need it now and #119 depends
-- on this migration anyway (its `recipe_ingredients.ingredient_id` FK needs
-- `public.ingredients` to exist). #119's `recipe_ingredients.unit` column
-- must reuse `public.recipe_unit` rather than creating its own enum type.

-- ============================================================================
-- reference schema (ADR-0011 §1): shared, non-user data. No user_id column
-- on any table here, ever — that is what makes this schema safe to expose
-- with select-only grants to authenticated and anon. RLS is enabled anyway
-- as defence in depth: the grants already block writes, so a future mistaken
-- grant can't silently open one.
-- ============================================================================

create schema reference;

comment on schema reference is
  'Shared, non-user reference data (ADR-0011). No user_id column is ever '
  'permitted here; scripts/check-rls-coverage.sh''s reference pass asserts '
  'that. Data changes exclusively through migrations, never client writes.';

-- authenticated/anon get USAGE so they can even look up objects in this
-- schema — public's equivalent is implicit (USAGE on public is granted to
-- the PUBLIC pseudo-role by default), but a newly created schema is not.
-- USAGE alone grants no data access; the per-table SELECT grants below do.
grant usage on schema reference to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- public.recipe_unit: the shared unit enum (ADR-0011 §3 coordination note
-- above). Values are the exact `code`s from lib/recipes/units.ts's
-- UNIT_CODES (#120) — tests/recipes-units-enum-sync.test.ts asserts this
-- migration's enum values equal UNIT_CODES exactly. Both
-- ingredient_unit_masses tables below use it; #119's recipe_ingredients.unit
-- reuses it too instead of declaring a second type.
-- ----------------------------------------------------------------------------

create type public.recipe_unit as enum (
  'gram',
  'kilogram',
  'ounce',
  'pound',
  'milliliter',
  'deciliter',
  'liter',
  'theelepel',
  'eetlepel',
  'cup',
  'teaspoon',
  'tablespoon',
  'fluid_ounce',
  'stuk',
  'snufje',
  'scoop',
  'naar_smaak'
);

-- ----------------------------------------------------------------------------
-- reference.ingredients
-- ----------------------------------------------------------------------------

create table reference.ingredients (
  id uuid primary key default gen_random_uuid(),
  name_nl text not null,
  name_en text,
  category text,
  -- Nullable per ADR-0011 §4: NULL means unknown and must never be read or
  -- displayed as 0. No import runs in this migration (#130 is schema-only),
  -- so every seed row below leaves these NULL.
  kcal_per_100g numeric,
  protein_g_per_100g numeric,
  carbs_g_per_100g numeric,
  fat_g_per_100g numeric,
  -- Attribution is a schema obligation (ADR-0011 §5), not a README one:
  -- source_ref is the upstream identifier (e.g. a USDA fdc_id) when a row's
  -- numbers come from one; source/source_version are mandatory even for
  -- rows with no numbers yet (this migration's seed), because they record
  -- the provenance of the row's *identity*, not only its nutrition figures.
  -- Never mix sources within one row's nutrient set (ADR-0011 §5).
  source text not null,
  source_ref text,
  source_version text not null
);

comment on table reference.ingredients is
  'Canonical, hand-curated ingredient library (ADR-0011 §2). No user_id: '
  'this is shared reference data, immutable outside migrations. '
  'kcal/protein/carbs/fat are nullable and NULL must never be treated as 0.';

alter table reference.ingredients enable row level security;

create policy ingredients_select_all on reference.ingredients
  for select using (true);

grant select on reference.ingredients to authenticated, anon;
grant select on reference.ingredients to service_role;

-- ----------------------------------------------------------------------------
-- reference.ingredient_unit_masses
-- ----------------------------------------------------------------------------

create table reference.ingredient_unit_masses (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references reference.ingredients (id) on delete cascade,
  unit public.recipe_unit not null,
  grams numeric not null,
  source text not null,
  source_version text not null,
  unique (ingredient_id, unit)
);

comment on table reference.ingredient_unit_masses is
  'Per-(ingredient, unit) gram weight, e.g. "1 cup rolled oats = 81 g" '
  '(ADR-0011 §3). Reference layer of the resolution order user override -> '
  'reference -> unresolved; the resolution function itself is #122, not '
  'here. Not seeded in this migration -- no licensed mass data is imported '
  'yet, only the ingredient identities below.';

create index ingredient_unit_masses_ingredient_id_idx
  on reference.ingredient_unit_masses (ingredient_id);

alter table reference.ingredient_unit_masses enable row level security;

create policy ingredient_unit_masses_select_all on reference.ingredient_unit_masses
  for select using (true);

grant select on reference.ingredient_unit_masses to authenticated, anon;
grant select on reference.ingredient_unit_masses to service_role;

-- ============================================================================
-- public schema extensions (ADR-0001/0009 full treatment, ADR-0011 §2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.ingredients
-- ----------------------------------------------------------------------------

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable: a self-added ingredient has reference_id is null (ADR-0011
  -- §2). Picking a library ingredient materialises/reuses a row that links
  -- here; on delete set null so removing a reference row (a migration-only
  -- event) never cascades into deleting a user's own ingredient.
  reference_id uuid references reference.ingredients (id) on delete set null,
  -- The name the user sees and may rename freely, independent of the
  -- reference row's name_nl (ADR-0011 §2).
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ingredients is
  'Per-user ingredient list (ADR-0011 §2). reference_id links to '
  'reference.ingredients for library picks; null means self-added.';

create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

create index ingredients_user_id_idx on public.ingredients (user_id);
create index ingredients_reference_id_idx on public.ingredients (reference_id);

alter table public.ingredients enable row level security;

create policy ingredients_select_own on public.ingredients
  for select using (user_id = (select auth.uid()));
create policy ingredients_insert_own on public.ingredients
  for insert with check (user_id = (select auth.uid()));
create policy ingredients_update_own on public.ingredients
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ingredients_delete_own on public.ingredients
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ingredients to authenticated;
grant select on public.ingredients to anon;
grant select, insert, update, delete on public.ingredients to service_role;

-- ----------------------------------------------------------------------------
-- public.ingredient_unit_masses
-- ----------------------------------------------------------------------------

create table public.ingredient_unit_masses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  unit public.recipe_unit not null,
  grams numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id, unit)
);

comment on table public.ingredient_unit_masses is
  'Per-user override of a per-(ingredient, unit) gram weight (ADR-0011 §3). '
  'Resolution order is this table first, then '
  'reference.ingredient_unit_masses, then unresolved -- never a silent 0.';

create trigger ingredient_unit_masses_set_updated_at
  before update on public.ingredient_unit_masses
  for each row execute function public.set_updated_at();

create index ingredient_unit_masses_user_id_idx on public.ingredient_unit_masses (user_id);
create index ingredient_unit_masses_ingredient_id_idx on public.ingredient_unit_masses (ingredient_id);

alter table public.ingredient_unit_masses enable row level security;

create policy ingredient_unit_masses_select_own on public.ingredient_unit_masses
  for select using (user_id = (select auth.uid()));
create policy ingredient_unit_masses_insert_own on public.ingredient_unit_masses
  for insert with check (user_id = (select auth.uid()));
create policy ingredient_unit_masses_update_own on public.ingredient_unit_masses
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ingredient_unit_masses_delete_own on public.ingredient_unit_masses
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ingredient_unit_masses to authenticated;
grant select on public.ingredient_unit_masses to anon;
grant select, insert, update, delete on public.ingredient_unit_masses to service_role;

-- ============================================================================
-- Seed: reference.ingredients, as a migration -- not a per-user trigger
-- (ADR-0011 §5, "the seed is a migration, not a per-user trigger": unlike
-- the Kanban default-board seed in 20260723000001_kanban_schema.sql, this
-- is loaded once for the deployment, not once per account).
--
-- Ten names from the design mock (node 3957:10356, with its duplicate
-- "Citroen" copy-paste error not re-seeded as a second row) plus three more
-- named in the ticket's example recipes (Citroen already covered):
-- Havermout, Proteïnepoeder, Banaan. 13 rows total.
--
-- Note: the #130 ticket body's prose calls the first group "nine unique
-- names" but its own enumerated list (Appel, Blauwe bes, Citroen, Dadels,
-- Erwten, Falafel, Gamba's, Halloumi, IJsbergsla, Jam) has ten distinct
-- entries once the duplicate Citroen is dropped. This migration seeds the
-- explicit named list literally rather than truncating it to match the
-- prose's count -- flagged in the PR as a ticket-text inconsistency, not
-- resolved unilaterally.
--
-- No USDA/CIQUAL/NEVO data is imported here (out of scope for #130, and
-- NEVO is licence-barred from this repo entirely per ADR-0011 §5) -- every
-- nutrition column is left NULL (unknown, never 0). source/source_version
-- record that this row's *name and identity* are this project's own
-- hand-curated list, not a claim about any upstream nutrition database.
-- name_en values are plain dictionary translations of the Dutch name, not
-- sourced data, so they carry no separate attribution.
-- ============================================================================

insert into reference.ingredients (name_nl, name_en, source, source_version) values
  ('Appel', 'Apple', 'hand-curated', '2026-07-30'),
  ('Blauwe bes', 'Blueberry', 'hand-curated', '2026-07-30'),
  ('Citroen', 'Lemon', 'hand-curated', '2026-07-30'),
  ('Dadels', 'Dates', 'hand-curated', '2026-07-30'),
  ('Erwten', 'Peas', 'hand-curated', '2026-07-30'),
  ('Falafel', 'Falafel', 'hand-curated', '2026-07-30'),
  ('Gamba''s', 'Prawns', 'hand-curated', '2026-07-30'),
  ('Halloumi', 'Halloumi', 'hand-curated', '2026-07-30'),
  ('IJsbergsla', 'Iceberg lettuce', 'hand-curated', '2026-07-30'),
  ('Jam', 'Jam', 'hand-curated', '2026-07-30'),
  ('Havermout', 'Oats', 'hand-curated', '2026-07-30'),
  ('Proteïnepoeder', 'Protein powder', 'hand-curated', '2026-07-30'),
  ('Banaan', 'Banana', 'hand-curated', '2026-07-30');
