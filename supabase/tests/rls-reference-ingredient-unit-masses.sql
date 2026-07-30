-- reference.ingredient_unit_masses is shared, non-user data (ADR-0011 §1/§3),
-- same test shape as rls-reference-ingredients.sql -- see that file's header
-- for the rationale. The migration seeds reference.ingredients but not this
-- table (no licensed mass data ships in #130), so two fixture rows are
-- inserted here as the unrestricted setup role (mirrors how other RLS tests
-- in this directory seed auth.users before any `set local role`) purely so
-- there is something for both test users to read.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000009a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000009b', 'b@test.local');

insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
values
  ((select id from reference.ingredients where name_nl = 'Havermout' limit 1), 'cup', 81, 'test-fixture', '1'),
  ((select id from reference.ingredients where name_nl = 'Banaan' limit 1), 'stuk', 118, 'test-fixture', '1');

set local role authenticated;

-- Both users see the same full fixture set.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009a", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::int from reference.ingredient_unit_masses $$,
  $$ values (2) $$,
  'A sees both fixture rows'
);
select results_eq(
  $$ select grams::numeric from reference.ingredient_unit_masses where unit = 'stuk' $$,
  $$ values (118::numeric) $$,
  'A sees the Banaan/stuk fixture value'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009b", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::int from reference.ingredient_unit_masses $$,
  $$ values (2) $$,
  'B sees the same two fixture rows as A'
);
select results_eq(
  $$ select grams::numeric from reference.ingredient_unit_masses where unit = 'stuk' $$,
  $$ values (118::numeric) $$,
  'B sees the same Banaan/stuk fixture value too'
);

-- Writes fail for both users -- grants only allow select.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009a", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel' limit 1), 'gram', 1, 'test', '1') $$,
  '42501',
  null,
  'A cannot insert into reference.ingredient_unit_masses'
);
select throws_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where unit = 'stuk' $$,
  '42501',
  null,
  'A cannot update reference.ingredient_unit_masses'
);
select throws_ok(
  $$ delete from reference.ingredient_unit_masses where unit = 'stuk' $$,
  '42501',
  null,
  'A cannot delete from reference.ingredient_unit_masses'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009b", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel' limit 1), 'gram', 1, 'test', '1') $$,
  '42501',
  null,
  'B cannot insert into reference.ingredient_unit_masses'
);
select throws_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where unit = 'stuk' $$,
  '42501',
  null,
  'B cannot update reference.ingredient_unit_masses'
);
select throws_ok(
  $$ delete from reference.ingredient_unit_masses where unit = 'stuk' $$,
  '42501',
  null,
  'B cannot delete from reference.ingredient_unit_masses'
);

-- Writes fail for anon too.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel' limit 1), 'gram', 1, 'test', '1') $$,
  '42501',
  null,
  'anon cannot insert into reference.ingredient_unit_masses'
);
select throws_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where unit = 'stuk' $$,
  '42501',
  null,
  'anon cannot update reference.ingredient_unit_masses'
);
select throws_ok(
  $$ delete from reference.ingredient_unit_masses where unit = 'stuk' $$,
  '42501',
  null,
  'anon cannot delete from reference.ingredient_unit_masses'
);

select * from finish();
rollback;
