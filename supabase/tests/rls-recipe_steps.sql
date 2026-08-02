-- Two-user isolation test for recipe_steps (ADR-0009 pattern, copied from
-- rls-profiles.sql). Each user gets their own recipe (via their own
-- auto-seeded category) first, then one preparation step on it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000da', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000db', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000da", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-0000000000da',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000da' limit 1),
  'A''s recipe', 2, 1000
);
insert into public.recipe_steps (user_id, recipe_id, position, instruction)
values (
  '00000000-0000-0000-0000-0000000000da',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000da' limit 1),
  1000, 'A''s first step'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000db", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-0000000000db',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000db' limit 1),
  'B''s recipe', 4, 1000
);
insert into public.recipe_steps (user_id, recipe_id, position, instruction)
values (
  '00000000-0000-0000-0000-0000000000db',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000db' limit 1),
  1000, 'B''s first step'
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000da", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipe_steps $$,
  $$ values (1) $$,
  'A sees exactly one recipe_steps row (their own)'
);
select results_eq(
  $$ select instruction from public.recipe_steps $$,
  $$ values ('A''s first step') $$,
  'the visible recipe_steps row is A''s own'
);
select is_empty(
  $$ update public.recipe_steps set instruction = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000000db' returning id $$,
  'A cannot update B''s recipe_steps row'
);
select is_empty(
  $$ delete from public.recipe_steps
     where user_id = '00000000-0000-0000-0000-0000000000db' returning id $$,
  'A cannot delete B''s recipe_steps row'
);
select throws_ok(
  $$ insert into public.recipe_steps (user_id, recipe_id, position, instruction)
     values (
       '00000000-0000-0000-0000-0000000000db',
       (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000da' limit 1),
       2000, 'sneaky step'
     ) $$,
  '42501',
  null,
  'A cannot insert a recipe_steps row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipe_steps $$,
  'anon sees no recipe_steps rows'
);

select * from finish();
rollback;
