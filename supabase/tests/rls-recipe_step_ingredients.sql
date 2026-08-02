-- Two-user isolation test for recipe_step_ingredients (ADR-0009 pattern,
-- copied from rls-recipe_steps.sql). Each user gets their own recipe (via
-- their own auto-seeded category), one ingredient line and one step on it,
-- then a step<->ingredient link (#149). Also asserts
-- public.replace_recipe_contents refuses to touch another user's recipe
-- (the RPC's own ownership guard, on top of RLS).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ea', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000eb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000ea',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
  'A''s recipe', 2
);
insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, position)
values (
  '00000000-0000-0000-0000-0000000000ea',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
  'A''s havermout', 100, 'gram', 1000
);
insert into public.recipe_steps (user_id, recipe_id, position, instruction)
values (
  '00000000-0000-0000-0000-0000000000ea',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
  1000, 'A''s first step'
);
insert into public.recipe_step_ingredients (user_id, step_id, recipe_ingredient_id, position)
values (
  '00000000-0000-0000-0000-0000000000ea',
  (select id from public.recipe_steps where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
  (select id from public.recipe_ingredients where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
  1000
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000eb", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000eb',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  'B''s recipe', 4
);
insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, position)
values (
  '00000000-0000-0000-0000-0000000000eb',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  'B''s banaan', 2, 'stuk', 1000
);
insert into public.recipe_steps (user_id, recipe_id, position, instruction)
values (
  '00000000-0000-0000-0000-0000000000eb',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  1000, 'B''s first step'
);
insert into public.recipe_step_ingredients (user_id, step_id, recipe_ingredient_id, position)
values (
  '00000000-0000-0000-0000-0000000000eb',
  (select id from public.recipe_steps where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  (select id from public.recipe_ingredients where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  1000
);

-- Stash B's real recipe id in a session GUC (is_local = true, so it lives
-- only for this transaction, same lifetime as `set local`) while still
-- acting as B. A plain subquery for B's recipe id under A's own RLS would
-- already come back NULL before ever reaching the function -- that would
-- only prove RLS blocks the lookup, not that replace_recipe_contents' own
-- explicit ownership guard (the "belt-and-braces" check in its body) fires
-- for a real, resolvable id belonging to someone else.
select set_config(
  'app.b_recipe_id',
  (select id::text from public.recipes where user_id = '00000000-0000-0000-0000-0000000000eb' limit 1),
  true
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipe_step_ingredients $$,
  $$ values (1) $$,
  'A sees exactly one recipe_step_ingredients row (their own)'
);
select results_eq(
  $$ select user_id from public.recipe_step_ingredients $$,
  $$ values ('00000000-0000-0000-0000-0000000000ea'::uuid) $$,
  'the visible recipe_step_ingredients row belongs to A'
);
select is_empty(
  $$ update public.recipe_step_ingredients set position = 2000
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot update B''s recipe_step_ingredients row'
);
select is_empty(
  $$ delete from public.recipe_step_ingredients
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot delete B''s recipe_step_ingredients row'
);
select throws_ok(
  $$ insert into public.recipe_step_ingredients (user_id, step_id, recipe_ingredient_id, position)
     values (
       '00000000-0000-0000-0000-0000000000eb',
       (select id from public.recipe_steps where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
       (select id from public.recipe_ingredients where user_id = '00000000-0000-0000-0000-0000000000ea' limit 1),
       2000
     ) $$,
  '42501',
  null,
  'A cannot insert a recipe_step_ingredients row for B'
);
select throws_ok(
  $$ select public.replace_recipe_contents(
       current_setting('app.b_recipe_id')::uuid,
       '[]'::jsonb,
       '[]'::jsonb
     ) $$,
  'P0001',
  null,
  'A cannot replace_recipe_contents on B''s recipe'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipe_step_ingredients $$,
  'anon sees no recipe_step_ingredients rows'
);

select * from finish();
rollback;
