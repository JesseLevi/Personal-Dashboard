-- #155: recipes gain a real `position` column so a recipe card can be
-- dragged between (and reordered within) `/recepten` category columns, the
-- same "zoals tickets bij te-doen dat wel kunnen" parity the user asked for.
-- Supersedes the "recipes are not reordered within a category in this
-- phase's design" decision `20260730000002_recipe_schema.sql` recorded --
-- see that migration's table comment, rewritten below, and
-- `design/notes/ReceptenBoard.md`'s "Drag & drop" section for the full
-- history (#124 disabled dragging for exactly this reason; #155 reverses
-- it once the column exists to persist a drop against).
--
-- Three separate statements, not one `add column ... not null default ...`:
--   1. `add column position numeric` (nullable) -- a `not null` add would
--      fail outright against the existing rows in this table.
--   2. backfill every existing row, per category, `row_number() * 1000` --
--      same fractional-positioning scheme and same seed spacing as
--      `recipe_categories.position` / `board_columns.position`
--      (`lib/boards/positioning.ts`'s `POSITION_GAP`). A bare `default`
--      value would satisfy `not null` but collapse every existing recipe in
--      a category onto the same position, which is not an ordering.
--      Ordered by `created_at` (ties broken by `id` for a fully
--      deterministic order) -- the same column
--      `lib/recipes/queries.ts`'s `getRecipeCategoriesWithRecipes` currently
--      sorts by, so the backfilled `position` order matches what users
--      already see today; nothing visibly reorders the first time this
--      lands.
--   3. `alter column position set not null` -- safe now that every row has
--      a value.
--
-- No new index: unlike `recipe_categories.position` (has no sibling
-- ordering column to combine with), this mirrors `public.cards` exactly --
-- `cards.position` (`20260723000001_kanban_schema.sql`) has no index of its
-- own either, only `cards_column_id_idx`. `recipes_category_id_idx`
-- (already created by `20260730000002_recipe_schema.sql`) is that same
-- shape of index and needs no change; a composite `(category_id, position)`
-- index would be new ground this schema's own house style doesn't set for
-- an ordering column, so it isn't added here.
--
-- No new RLS policies/grants: `recipes` already has full
-- select/insert/update/delete-own policies + grants
-- (`20260730000002_recipe_schema.sql`) that cover every column on the row,
-- `position` included -- adding a column to an already-RLS'd table needs
-- neither. `supabase/tests/rls-recipes.sql`'s existing isolation
-- assertions (A/B can't read/update/delete each other's rows) still cover
-- this column the same way they cover every other one; verified, not
-- re-derived (see the PR/commit description).
--
-- ADR-0012 amendment 2 (2026-08-02): this migration reaches the hosted
-- database only via the confirm-then-apply, `workflow_dispatch`-only
-- deploy workflow -- merging this PR does NOT push it to production by
-- itself. See `docs/guides/data-layer.md`'s ADR-0012 bullet.

alter table public.recipes add column position numeric;

with ordered as (
  select
    id,
    row_number() over (
      partition by category_id
      order by created_at, id
    ) as rn
  from public.recipes
)
update public.recipes r
set position = ordered.rn * 1000
from ordered
where ordered.id = r.id;

alter table public.recipes alter column position set not null;

comment on table public.recipes is
  'One row per recipe. position (#155): same fractional-positioning scheme '
  'as recipe_categories/recipe_ingredients/recipe_steps (lib/boards/'
  'positioning.ts''s nextPosition, new value = midpoint of its neighbors) '
  '-- recipes ARE now reordered within a category by drag & drop, reversing '
  'the "not reordered in this phase''s design" decision this comment '
  'previously recorded.';
