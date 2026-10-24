-- reference.ingredient_unit_masses is shared, non-user data (ADR-0011
-- §1/§3), same test shape as rls-reference-ingredients.sql -- see that
-- file's header for the rationale.
--
-- Unlike when this test was first written (#130: table seeded with
-- nothing, two throwaway fixture rows were the only data), the table now
-- carries real bulk-seeded data from #163's
-- 20260806000002_nevo_unit_masses.sql (NEVO Portie-online, source_ref join
-- against #161's 2328-row reference.ingredients) and #164/#157's
-- 20260807000001_usda_unit_masses.sql (USDA cup/tbsp/tsp pairings) --
-- roughly 1.3k rows combined. This test still inserts its own two fixture
-- rows (setup, below) so there is a value it fully controls to assert an
-- exact grams figure against, same as before.
--
-- Two things changed from the original version of this test, both because
-- the old 13-row hand-curated seed (with ingredients named 'Havermout' and
-- 'Banaan') is gone, replaced by the real NEVO-online names:
--   1. The fixture used to key off 'Havermout', which #161 deleted along
--      with the rest of the old seed -- the lookup silently resolved to
--      NULL and the insert violated ingredient_id's NOT NULL constraint
--      (`ingredient_unit_masses.ingredient_id uuid not null references
--      reference.ingredients`), failing this test outright. The fixture
--      below instead uses 'Banaan' (still present, now sourced from NEVO)
--      and 'Appel z schil gem' (a real NEVO-online row, source_ref '147')
--      -- both confirmed absent from both bulk-seed migrations above (grep
--      for `'151',`/`'147',` in their value lists), so the fixture inserts
--      cannot collide with the (ingredient_id, unit) unique constraint.
--   2. The old `count(*) = 2` / `where unit = 'stuk'` assertions assumed
--      the two fixture rows were the *only* rows in the table. With the
--      real bulk seed now present, count(*) is ~1.3k and 'stuk' is used by
--      many real rows, so both would either fail outright or (worse) pass
--      for the wrong reason. The visibility checks below instead assert a
--      lower-bound row count (proving the real bulk seed, not just the
--      fixtures, is visible) and scope the fixture-value check to this
--      test's own rows by (ingredient name, unit, source = 'test-fixture')
--      -- exact and collision-proof regardless of how much real data
--      exists alongside it. The lower bound (1000) is deliberately not the
--      bulk seed's exact row count: 20260806000002's own header documents
--      that its source_ref join silently drops the small fraction of
--      Portie codes absent from the #161 seed, so the exact total isn't a
--      fixed constant the way reference.ingredients' 2328 is -- a
--      generous-but-real threshold stays true without re-breaking on a
--      future reseed that shifts the drop count by a few rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000009a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000009b', 'b@test.local');

insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
values
  ((select id from reference.ingredients where name_nl = 'Banaan' limit 1), 'stuk', 118, 'test-fixture', '1'),
  ((select id from reference.ingredients where name_nl = 'Appel z schil gem' limit 1), 'cup', 81, 'test-fixture', '1');

set local role authenticated;

-- Both users see the same rows: the real bulk seed (lower-bound sanity
-- check) plus this test's own fixture rows (exact value check).
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009a", "role": "authenticated"}';
select ok(
  (select count(*) > 1000 from reference.ingredient_unit_masses),
  'A sees the real NEVO/USDA bulk-seeded rows, not just the fixtures'
);
select results_eq(
  $$ select ium.grams::numeric from reference.ingredient_unit_masses ium
     join reference.ingredients ri on ri.id = ium.ingredient_id
     where ri.name_nl = 'Banaan' and ium.unit = 'stuk' and ium.source = 'test-fixture' $$,
  $$ values (118::numeric) $$,
  'A sees the Banaan/stuk fixture value'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009b", "role": "authenticated"}';
select ok(
  (select count(*) > 1000 from reference.ingredient_unit_masses),
  'B sees the same real bulk-seeded rows as A'
);
select results_eq(
  $$ select ium.grams::numeric from reference.ingredient_unit_masses ium
     join reference.ingredients ri on ri.id = ium.ingredient_id
     where ri.name_nl = 'Banaan' and ium.unit = 'stuk' and ium.source = 'test-fixture' $$,
  $$ values (118::numeric) $$,
  'B sees the same Banaan/stuk fixture value too'
);

-- Non-admin authenticated: insert is refused by the with-check (42501);
-- update/delete are filtered by the using-clause (no error, zero rows).
-- Admin writes are covered in rls-reference-admin-writes.sql.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009a", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel z schil gem' limit 1), 'gram', 1, 'test', '1') $$,
  '42501',
  null,
  'A cannot insert into reference.ingredient_unit_masses'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where unit = 'stuk' $$,
  'A (non-admin) update is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredient_unit_masses where unit = 'stuk' $$,
  'A (non-admin) delete is filtered by RLS: no error, zero rows'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000009b", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel z schil gem' limit 1), 'gram', 1, 'test', '1') $$,
  '42501',
  null,
  'B cannot insert into reference.ingredient_unit_masses'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where unit = 'stuk' $$,
  'B (non-admin) update is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredient_unit_masses where unit = 'stuk' $$,
  'B (non-admin) delete is filtered by RLS: no error, zero rows'
);

select is(
  (select count(*)::int from reference.ingredient_unit_masses where grams = 999),
  0,
  'non-admin update left no 999 g row behind'
);
select is(
  (select ium.grams::numeric from reference.ingredient_unit_masses ium
   join reference.ingredients ri on ri.id = ium.ingredient_id
   where ri.name_nl = 'Banaan' and ium.unit = 'stuk' and ium.source = 'test-fixture'),
  118::numeric,
  'non-admin delete left the Banaan/stuk fixture in place'
);

-- anon has no access to the reference schema (20261024000004): reads and
-- writes both fail at the grant.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select 1 from reference.ingredient_unit_masses $$,
  '42501',
  null,
  'anon cannot read reference.ingredient_unit_masses'
);
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Appel z schil gem' limit 1), 'gram', 1, 'test', '1') $$,
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
