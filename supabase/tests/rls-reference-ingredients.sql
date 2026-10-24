-- reference.ingredients is shared, non-user data (ADR-0011 §1), not
-- per-user isolated like the rls-<table>.sql pattern in this directory --
-- see that file's header. This test shape instead asserts: both test users
-- read the exact same full row set (the migration seed, 2328 rows since
-- #161's 20260806000001_nevo_nutrition_import.sql replaced the original
-- 13-row hand-curated seed with the full NEVO-online 2025/9.0 extract --
-- that migration's own header documents the 2328 figure), and every write
-- attempt -- insert, update, delete -- from both users and from anon fails
-- with 42501 (grants deny it; RLS's single select-only policy is the
-- second lock). 'Banaan' (used below as the known-present row) is part of
-- that NEVO seed, not the old hand-curated one -- picked because its
-- name_nl is stable/unaccented and unlikely to collide with a future NEVO
-- re-import. check-rls-coverage.sh's reference pass separately asserts the
-- schema-level shape (no user_id, select-only grants, RLS enabled) via
-- psql introspection; this pgTAP test is the explicit, separate requirement
-- from #130 covering runtime behaviour.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000008a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000008b', 'b@test.local');

set local role authenticated;

-- Both users see the same full seeded set.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000008a", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::int from reference.ingredients where source = 'NEVO-online' $$,
  $$ values (2328) $$,
  'A sees the full 2328-row NEVO-online migration seed'
);
select ok(
  (select true from reference.ingredients where name_nl = 'Banaan'),
  'A can see the Banaan seed row'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000008b", "role": "authenticated"}';
select results_eq(
  $$ select count(*)::int from reference.ingredients where source = 'NEVO-online' $$,
  $$ values (2328) $$,
  'B sees the same full 2328-row set as A'
);
select ok(
  (select true from reference.ingredients where name_nl = 'Banaan'),
  'B can see the Banaan seed row too'
);

-- Non-admin authenticated: insert is refused by the with-check (42501);
-- update/delete are filtered by the using-clause (no error, zero rows).
-- Admin writes are covered in rls-reference-admin-writes.sql.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000008a", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredients (name_nl, source, source_version)
     values ('Sneaky', 'test', '1') $$,
  '42501',
  null,
  'A cannot insert into reference.ingredients'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where name_nl = 'Banaan' $$,
  'A (non-admin) update is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredients where name_nl = 'Banaan' $$,
  'A (non-admin) delete is filtered by RLS: no error, zero rows'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000008b", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredients (name_nl, source, source_version)
     values ('Sneaky', 'test', '1') $$,
  '42501',
  null,
  'B cannot insert into reference.ingredients'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where name_nl = 'Banaan' $$,
  'B (non-admin) update is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredients where name_nl = 'Banaan' $$,
  'B (non-admin) delete is filtered by RLS: no error, zero rows'
);

select is(
  (select count(*)::int from reference.ingredients where name_nl = 'hacked'),
  0,
  'non-admin update left no hacked row behind'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Banaan'),
  1,
  'non-admin delete left the Banaan row in place'
);

-- anon has no access to the reference schema (20261024000004): reads and
-- writes both fail at the grant.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select 1 from reference.ingredients $$,
  '42501',
  null,
  'anon cannot read reference.ingredients'
);
select throws_ok(
  $$ insert into reference.ingredients (name_nl, source, source_version)
     values ('Sneaky', 'test', '1') $$,
  '42501',
  null,
  'anon cannot insert into reference.ingredients'
);
select throws_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where name_nl = 'Banaan' $$,
  '42501',
  null,
  'anon cannot update reference.ingredients'
);
select throws_ok(
  $$ delete from reference.ingredients where name_nl = 'Banaan' $$,
  '42501',
  null,
  'anon cannot delete from reference.ingredients'
);

select * from finish();
rollback;
