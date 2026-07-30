-- Two-user isolation test for recipe_categories (ADR-0009 pattern, copied
-- from rls-profiles.sql). Not seeded manually here: seed_default_recipe_categories()
-- fires on auth.users insert, so each user already has three categories
-- (Ontbijt/Lunch/Avond) before the assertions below run.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000aa', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000ab', 'b@test.local');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipe_categories $$,
  $$ values (3) $$,
  'A sees exactly three recipe_categories (their own seeded set)'
);
select results_eq(
  $$ select count(*)::int from public.recipe_categories
     where user_id = '00000000-0000-0000-0000-0000000000aa' $$,
  $$ values (3) $$,
  'all visible recipe_categories belong to A'
);
select is_empty(
  $$ update public.recipe_categories set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000000ab' returning id $$,
  'A cannot update B''s recipe_categories'
);
select is_empty(
  $$ delete from public.recipe_categories
     where user_id = '00000000-0000-0000-0000-0000000000ab' returning id $$,
  'A cannot delete B''s recipe_categories'
);
select throws_ok(
  $$ insert into public.recipe_categories (user_id, name, icon, position)
     values ('00000000-0000-0000-0000-0000000000ab', 'sneaky', 'Croissant', 4000) $$,
  '42501',
  null,
  'A cannot insert a recipe_categories row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipe_categories $$,
  'anon sees no recipe_categories'
);

select * from finish();
rollback;
