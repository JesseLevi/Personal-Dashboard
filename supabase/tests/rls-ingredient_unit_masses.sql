-- Two-user isolation test for ingredient_unit_masses (ADR-0009 pattern,
-- copied from rls-profiles.sql). ADR-0011 §3: per-user override of a
-- per-(ingredient, unit) gram weight. Each user gets their own ingredient
-- row first (own FK target), then a unit mass row on it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000007a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000007b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000007a", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000007a', 'A''s havermout');
insert into public.ingredient_unit_masses (user_id, ingredient_id, unit, grams)
values (
  '00000000-0000-0000-0000-00000000007a',
  (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000007a' limit 1),
  'cup', 81
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000007b", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000007b', 'B''s havermout');
insert into public.ingredient_unit_masses (user_id, ingredient_id, unit, grams)
values (
  '00000000-0000-0000-0000-00000000007b',
  (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000007b' limit 1),
  'cup', 90
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000007a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.ingredient_unit_masses $$,
  $$ values (1) $$,
  'A sees exactly one ingredient_unit_masses row (their own)'
);
select results_eq(
  $$ select user_id from public.ingredient_unit_masses $$,
  $$ values ('00000000-0000-0000-0000-00000000007a'::uuid) $$,
  'the visible ingredient_unit_masses row belongs to A'
);
select is_empty(
  $$ update public.ingredient_unit_masses set grams = 999
     where user_id = '00000000-0000-0000-0000-00000000007b' returning id $$,
  'A cannot update B''s ingredient_unit_masses row'
);
select is_empty(
  $$ delete from public.ingredient_unit_masses
     where user_id = '00000000-0000-0000-0000-00000000007b' returning id $$,
  'A cannot delete B''s ingredient_unit_masses row'
);
select throws_ok(
  $$ insert into public.ingredient_unit_masses (user_id, ingredient_id, unit, grams)
     values (
       '00000000-0000-0000-0000-00000000007b',
       (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000007a' limit 1),
       'gram', 5
     ) $$,
  '42501',
  null,
  'A cannot insert an ingredient_unit_masses row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.ingredient_unit_masses $$,
  'anon sees no ingredient_unit_masses rows'
);

select * from finish();
rollback;
