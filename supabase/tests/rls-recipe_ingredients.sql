-- Two-user isolation test for recipe_ingredients (ADR-0009 pattern, copied
-- from rls-profiles.sql). Each user gets their own recipe (via their own
-- auto-seeded category) first, then an ingredient line on it. ingredient_id
-- is left null: it's a nullable enrichment FK (ADR-0011 §2), unrelated to
-- RLS isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ca', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000cb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000ca',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000ca' limit 1),
  'A''s recipe', 2
);
insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, position)
values (
  '00000000-0000-0000-0000-0000000000ca',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000ca' limit 1),
  'A''s havermout', 100, 'gram', 1000
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000cb", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000cb',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000cb' limit 1),
  'B''s recipe', 4
);
insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, position)
values (
  '00000000-0000-0000-0000-0000000000cb',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000cb' limit 1),
  'B''s banaan', 2, 'stuk', 1000
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipe_ingredients $$,
  $$ values (1) $$,
  'A sees exactly one recipe_ingredients row (their own)'
);
select results_eq(
  $$ select name from public.recipe_ingredients $$,
  $$ values ('A''s havermout') $$,
  'the visible recipe_ingredients row is A''s own'
);
select is_empty(
  $$ update public.recipe_ingredients set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000000cb' returning id $$,
  'A cannot update B''s recipe_ingredients row'
);
select is_empty(
  $$ delete from public.recipe_ingredients
     where user_id = '00000000-0000-0000-0000-0000000000cb' returning id $$,
  'A cannot delete B''s recipe_ingredients row'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (user_id, recipe_id, name, quantity, unit, position)
     values (
       '00000000-0000-0000-0000-0000000000cb',
       (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000ca' limit 1),
       'sneaky ingredient', 1, 'stuk', 2000
     ) $$,
  '42501',
  null,
  'A cannot insert a recipe_ingredients row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipe_ingredients $$,
  'anon sees no recipe_ingredients rows'
);

select * from finish();
rollback;
