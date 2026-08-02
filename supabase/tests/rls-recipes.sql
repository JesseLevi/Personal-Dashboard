-- Two-user isolation test for recipes (ADR-0009 pattern, copied from
-- rls-profiles.sql). Each user's recipe uses their own auto-seeded default
-- category (seed_default_recipe_categories()) as its category_id FK target.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ba', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000bb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ba", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-0000000000ba',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000ba' limit 1),
  'A''s recipe', 2, 1000
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000bb", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-0000000000bb',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000bb' limit 1),
  'B''s recipe', 4, 1000
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ba", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipes $$,
  $$ values (1) $$,
  'A sees exactly one recipe (their own)'
);
select results_eq(
  $$ select title from public.recipes $$,
  $$ values ('A''s recipe') $$,
  'the visible recipe is A''s own'
);
select is_empty(
  $$ update public.recipes set title = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000000bb' returning id $$,
  'A cannot update B''s recipe'
);
select is_empty(
  $$ delete from public.recipes
     where user_id = '00000000-0000-0000-0000-0000000000bb' returning id $$,
  'A cannot delete B''s recipe'
);
select throws_ok(
  $$ insert into public.recipes (user_id, category_id, title, servings, position)
     values (
       '00000000-0000-0000-0000-0000000000bb',
       (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000ba' limit 1),
       'sneaky recipe', 1, 5000
     ) $$,
  '42501',
  null,
  'A cannot insert a recipe for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipes $$,
  'anon sees no recipes'
);

select * from finish();
rollback;
