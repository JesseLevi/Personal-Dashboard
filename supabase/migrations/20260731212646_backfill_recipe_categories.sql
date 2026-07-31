-- Backfill (#119/#130 follow-up): existing accounts predate
-- seed_default_recipe_categories() (20260730000002_recipe_schema.sql), whose
-- trigger only fires `after insert on auth.users` -- it never runs for rows
-- already in auth.users at the time the trigger was created. Without this,
-- any account created before the two Phase 4 migrations were applied to the
-- hosted database sees an empty, column-less /recepten board.
--
-- Idempotent by construction: inserts the same three
-- (user_id, name) pairs the trigger would have created, guarded by
-- `not exists` so re-running this migration (or re-running it against a
-- database where the trigger already handled a given user) creates no
-- duplicates. Safe to run whether or not the trigger already seeded a user.

insert into public.recipe_categories (user_id, name, icon, position)
select u.id, seed.name, seed.icon, seed.position
from auth.users u
cross join (
  values
    ('Ontbijt', 'Croissant', 1000),
    ('Lunch', 'Sandwich', 2000),
    ('Avond', 'Broccoli', 3000)
) as seed(name, icon, position)
where not exists (
  select 1
  from public.recipe_categories rc
  where rc.user_id = u.id
    and rc.name = seed.name
);
