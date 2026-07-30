-- Phase 4 (#119): recipe schema — recipe_categories, recipes,
-- recipe_ingredients, recipe_steps, tags, recipe_tags.
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009, same house style
-- as 20260720000001_profiles.sql / 20260723000001_kanban_schema.sql /
-- 20260730000001_ingredient_library.sql.
--
-- This migration REUSES public.recipe_unit, created by #130
-- (20260730000001_ingredient_library.sql) precisely so both
-- ingredient_unit_masses tables and this migration's recipe_ingredients.unit
-- share one type. It does not declare a second unit enum — see
-- tests/recipes-units-enum-sync.test.ts, which asserts exactly that.
--
-- Four deliberate deviations from Architecture.md §4.2, approved by the user
-- (2026-07-29/30, issue #119) but not yet folded back into Architecture.md /
-- an ADR for the first three — that write-up is Fable's job, not Claude
-- Code's (docs/guides/ticket-workflow.md). The fourth already has an
-- accepted ADR.
--   a. recipe_categories.icon — §4.2 lists only (name, position). The recipe
--      overview's category columns show an icon next to name/count, same
--      pattern as board_columns.icon. Added.
--   b. recipe_ingredients.group_label (nullable text) — the recipe detail
--      page groups ingredients into named sections ("Wet"/"Dry"). Minimal
--      translation: one nullable column on the row, no separate
--      recipe_ingredient_groups table (no UI exists to manage groups, only
--      to display them).
--   c. recipe_ingredients.unit as public.recipe_unit (a Postgres enum)
--      instead of §4.2's free text — units come from a fixed dropdown, not
--      free text (user decision 2026-07-29). Same-dimension conversion only
--      (lib/recipes/units.ts, #120); no density table.
--   d. recipe_ingredients.ingredient_id — nullable FK into public.ingredients
--      (ADR-0011 §2, already accepted, needs no new write-up here).
--
-- Engineering calls made in this migration that are NOT one of the four
-- listed deviations (ordinary schema judgment, not an Architecture.md
-- conflict):
--   - recipes.category_id is `not null ... on delete cascade`. Architecture.md
--     §89 itself calls recipe_categories "the kanban columns of the recipe
--     overview" — mirrors board_columns.id -> cards.column_id exactly
--     (20260723000001_kanban_schema.sql): a recipe belongs to exactly one
--     category, and deleting a category removes its recipes the same way
--     deleting a board column removes its cards.
--   - recipes.servings is `not null default 1 check (servings > 0)`:
--     lib/recipes/units.ts's scaleQuantity() requires a positive
--     sourcePortions denominator, so a recipe must always have one.
--   - recipe_ingredients.quantity keeps its ADR-0011/ticket-mandated
--     nullability ("naar smaak") but is checked > 0 when present.
--   - tags gets `unique (user_id, name)` and recipe_tags gets
--     `unique (recipe_id, tag_id)` — ordinary data-integrity constraints,
--     not schema shape decisions.
--   - No pg_trgm index on recipe_ingredients.name/recipes.title here:
--     Architecture.md §103 places that work in Phase 7 (AI pipeline /
--     textual search), not Phase 4. The denormalised `name` column exists
--     now so that index has something to index later (ADR-0011 §2); the
--     index itself is out of this ticket's scope.

-- ============================================================================
-- recipe_categories
-- ============================================================================

create table public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Deviation (a): not in Architecture §4.2. Must be a value of the
  -- IconName union in components/atoms/Icon.tsx — PascalCase (e.g.
  -- 'Croissant'), same convention as board_columns.icon.
  icon text not null,
  -- Same fractional-positioning scheme as board_columns.position
  -- (lib/boards/positioning.ts, POSITION_GAP = 1000): new value = midpoint
  -- of its neighbors on reorder, instead of an O(n) rewrite.
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_categories is
  'User-defined "kanban columns" of the recipe overview (Architecture §89). '
  'Three are seeded per new user (Ontbijt/Lunch/Avond) by '
  'seed_default_recipe_categories() below, mirroring the Kanban default-'
  'board seed trigger in 20260723000001_kanban_schema.sql (#91).';

create trigger recipe_categories_set_updated_at
  before update on public.recipe_categories
  for each row execute function public.set_updated_at();

create index recipe_categories_user_id_idx on public.recipe_categories (user_id);

alter table public.recipe_categories enable row level security;

create policy recipe_categories_select_own on public.recipe_categories
  for select using (user_id = (select auth.uid()));
create policy recipe_categories_insert_own on public.recipe_categories
  for insert with check (user_id = (select auth.uid()));
create policy recipe_categories_update_own on public.recipe_categories
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_categories_delete_own on public.recipe_categories
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_categories to authenticated;
grant select on public.recipe_categories to anon;
grant select, insert, update, delete on public.recipe_categories to service_role;

-- ============================================================================
-- recipes
-- ============================================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- See file-header note: mirrors board_columns -> cards. Deleting a
  -- category deletes its recipes.
  category_id uuid not null references public.recipe_categories (id) on delete cascade,
  title text not null,
  -- See file-header note: always positive, scaleQuantity()'s denominator.
  servings integer not null default 1 check (servings > 0),
  -- Supabase Storage path (thumbnails bucket, Architecture §158). Nullable:
  -- not every recipe has a photo.
  thumbnail_path text,
  time_minutes integer check (time_minutes is null or time_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipes is
  'One row per recipe. No position column: recipes are not reordered within '
  'a category in this phase''s design, unlike recipe_categories/'
  'recipe_ingredients/recipe_steps.';

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create index recipes_user_id_idx on public.recipes (user_id);
create index recipes_category_id_idx on public.recipes (category_id);

alter table public.recipes enable row level security;

create policy recipes_select_own on public.recipes
  for select using (user_id = (select auth.uid()));
create policy recipes_insert_own on public.recipes
  for insert with check (user_id = (select auth.uid()));
create policy recipes_update_own on public.recipes
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipes_delete_own on public.recipes
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipes to authenticated;
grant select on public.recipes to anon;
grant select, insert, update, delete on public.recipes to service_role;

-- ============================================================================
-- recipe_ingredients
-- ============================================================================

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Deviation (d), ADR-0011 §2 (already accepted): nullable enrichment link,
  -- never a precondition to render. On delete set null -- removing/changing
  -- a user's ingredient-library row must never delete their recipe lines.
  ingredient_id uuid references public.ingredients (id) on delete set null,
  -- Denormalised, ALWAYS populated (ADR-0011 §2): this is what renders and
  -- keeps the future pg_trgm index (Architecture §103, Phase 7) working. A
  -- row with ingredient_id is null must still render fine.
  name text not null,
  -- Nullable per ticket ("naar smaak"); checked > 0 when present.
  quantity numeric check (quantity is null or quantity > 0),
  -- Deviation (c): public.recipe_unit, the shared enum #130 creates -- this
  -- migration does not declare a second unit type.
  unit public.recipe_unit not null,
  -- Same fractional-positioning scheme as recipe_categories.position.
  position numeric not null,
  -- Deviation (b): nullable named section ("Wet"/"Dry"). No separate
  -- recipe_ingredient_groups table -- see file-header note.
  group_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_ingredients is
  'One row per recipe ingredient line. ingredient_id is a nullable '
  'enrichment FK (ADR-0011 §2); name is the denormalised, always-populated '
  'column that actually renders. unit is public.recipe_unit (#130), not '
  'free text (deviation c).';

create trigger recipe_ingredients_set_updated_at
  before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

create index recipe_ingredients_user_id_idx on public.recipe_ingredients (user_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

alter table public.recipe_ingredients enable row level security;

create policy recipe_ingredients_select_own on public.recipe_ingredients
  for select using (user_id = (select auth.uid()));
create policy recipe_ingredients_insert_own on public.recipe_ingredients
  for insert with check (user_id = (select auth.uid()));
create policy recipe_ingredients_update_own on public.recipe_ingredients
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_ingredients_delete_own on public.recipe_ingredients
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select on public.recipe_ingredients to anon;
grant select, insert, update, delete on public.recipe_ingredients to service_role;

-- ============================================================================
-- recipe_steps
-- ============================================================================

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Same fractional-positioning scheme as recipe_categories.position.
  position numeric not null,
  instruction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_steps is 'Ordered preparation steps for a recipe.';

create trigger recipe_steps_set_updated_at
  before update on public.recipe_steps
  for each row execute function public.set_updated_at();

create index recipe_steps_user_id_idx on public.recipe_steps (user_id);
create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);

alter table public.recipe_steps enable row level security;

create policy recipe_steps_select_own on public.recipe_steps
  for select using (user_id = (select auth.uid()));
create policy recipe_steps_insert_own on public.recipe_steps
  for insert with check (user_id = (select auth.uid()));
create policy recipe_steps_update_own on public.recipe_steps
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_steps_delete_own on public.recipe_steps
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_steps to authenticated;
grant select on public.recipe_steps to anon;
grant select, insert, update, delete on public.recipe_steps to service_role;

-- ============================================================================
-- tags
-- ============================================================================
-- Pulled forward from Phase 6 (Architecture §4.2 lists tags under Notities).
-- Kept generic on purpose -- no recipe-specific column -- so Phase 6 can add
-- note_tags alongside recipe_tags without a migration conflict.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

comment on table public.tags is
  'User-scoped tags, shared vocabulary across modules (pulled forward from '
  'Phase 6 for the Phase 4 add-recipe flow). Generic on purpose: no '
  'recipe-specific column, so Phase 6 can add note_tags alongside '
  'recipe_tags without a migration conflict.';

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

create index tags_user_id_idx on public.tags (user_id);

alter table public.tags enable row level security;

create policy tags_select_own on public.tags
  for select using (user_id = (select auth.uid()));
create policy tags_insert_own on public.tags
  for insert with check (user_id = (select auth.uid()));
create policy tags_update_own on public.tags
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tags_delete_own on public.tags
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.tags to authenticated;
grant select on public.tags to anon;
grant select, insert, update, delete on public.tags to service_role;

-- ============================================================================
-- recipe_tags
-- ============================================================================

create table public.recipe_tags (
  id uuid primary key default gen_random_uuid(),
  -- ADR-0001 has no join-table exception: recipe_tags gets its own user_id
  -- even though it is reachable via recipes.user_id / tags.user_id too
  -- (same precedent as card_labels in 20260723000001_kanban_schema.sql).
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, tag_id)
);

comment on table public.recipe_tags is
  'Recipe <-> tag join table. Carries its own user_id per ADR-0001 (no '
  'exceptions, not even for join tables).';

create trigger recipe_tags_set_updated_at
  before update on public.recipe_tags
  for each row execute function public.set_updated_at();

create index recipe_tags_user_id_idx on public.recipe_tags (user_id);
create index recipe_tags_recipe_id_idx on public.recipe_tags (recipe_id);
create index recipe_tags_tag_id_idx on public.recipe_tags (tag_id);

alter table public.recipe_tags enable row level security;

create policy recipe_tags_select_own on public.recipe_tags
  for select using (user_id = (select auth.uid()));
create policy recipe_tags_insert_own on public.recipe_tags
  for insert with check (user_id = (select auth.uid()));
create policy recipe_tags_update_own on public.recipe_tags
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recipe_tags_delete_own on public.recipe_tags
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.recipe_tags to authenticated;
grant select on public.recipe_tags to anon;
grant select, insert, update, delete on public.recipe_tags to service_role;

-- ============================================================================
-- Seed: every new user gets three working recipe categories.
-- ============================================================================
-- Trigger-based, same approach and same reasoning as seed_default_board() in
-- 20260723000001_kanban_schema.sql (#91): a per-user category seed is a
-- per-account default, not shared data, so -- unlike #130's reference.
-- ingredients seed, which is a migration precisely because it is NOT
-- per-user (ADR-0011 §5) -- this belongs in a handle_new_user()-style
-- trigger. Reasons, mirrored from #91:
--   - a dedicated function keeps "seed starter recipe content" independently
--     readable/removable rather than growing into an unrelated concern;
--   - no ordering dependency on profiles/boards/other seed triggers, so
--     trigger-fire order between them doesn't matter;
--   - firing on auth.users insert (vs. lazily on first Recepten page load)
--     means every account gets its categories unconditionally, including
--     rows inserted directly by RLS test fixtures, with no "categories
--     don't exist yet" race on first visit.
-- Category names are hardcoded seed data, not UI copy -- same precedent as
-- 'Ideeën'/'Klaar'/'Bezig'/'Afgerond' in seed_default_board(), which are not
-- routed through next-intl either.
create function public.seed_default_recipe_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.recipe_categories (user_id, name, icon, position)
  values
    (new.id, 'Ontbijt', 'Croissant', 1000),
    (new.id, 'Lunch', 'Sandwich', 2000),
    (new.id, 'Avond', 'Broccoli', 3000);

  return new;
end;
$$;

create trigger on_auth_user_created_seed_recipe_categories
  after insert on auth.users
  for each row execute function public.seed_default_recipe_categories();
