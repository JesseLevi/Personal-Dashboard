-- reference.ingredient_aliases (#322, ADR-0020 §2) is shared, admin-curated
-- data: everyone reads, only an admin writes. Not the two-user isolation
-- shape of rls-<table>.sql -- there is no user_id. Also covers
-- public.is_admin() (ADR-0020 §1). Admin = authenticated role whose JWT
-- carries app_metadata.role = 'admin'.
-- Non-admin authenticated: insert is refused by the with-check (42501);
-- update/delete are filtered by the using-clause (no error, zero rows).
-- anon holds select only (writes fail at the grant, 42501) and no EXECUTE
-- on is_admin().
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000032a', 'admin@test.local'),
       ('00000000-0000-0000-0000-00000000032b', 'user@test.local');

-- Fixture alias, created as the postgres superuser.
insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
values ('bananen', (select id from reference.ingredients where name_nl = 'Banaan' limit 1));

-- ---- is_admin() -----------------------------------------------------------
set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032b", "role": "authenticated"}';
select is(public.is_admin(), false, 'is_admin() is false without an app_metadata role');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032b", "role": "authenticated", "app_metadata": {"role": "user"}}';
select is(public.is_admin(), false, 'is_admin() is false for another role value');

-- user_metadata is user-writable and must never grant admin.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032b", "role": "authenticated", "user_metadata": {"role": "admin"}}';
select is(public.is_admin(), false, 'is_admin() ignores user_metadata.role');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032a", "role": "authenticated", "app_metadata": {"role": "admin"}}';
select is(public.is_admin(), true, 'is_admin() is true for app_metadata.role = admin');

-- ---- non-admin authenticated ------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032b", "role": "authenticated"}';
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'bananen'),
  1,
  'non-admin can read shared aliases'
);
select throws_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('sneaky', (select id from reference.ingredients where name_nl = 'Banaan' limit 1)) $$,
  '42501',
  null,
  'non-admin cannot insert an alias'
);
select lives_ok(
  $$ update reference.ingredient_aliases set alias_normalized = 'hacked' where alias_normalized = 'bananen' $$,
  'non-admin update is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredient_aliases where alias_normalized = 'bananen' $$,
  'non-admin delete is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'hacked'),
  0,
  'non-admin update left no hacked alias behind'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'bananen'),
  1,
  'non-admin delete left the alias in place'
);

-- ---- admin ------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000032a", "role": "authenticated", "app_metadata": {"role": "admin"}}';
select lives_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('tomaten', (select id from reference.ingredients where name_nl = 'Banaan' limit 1)) $$,
  'admin can insert an alias'
);
select lives_ok(
  $$ update reference.ingredient_aliases set alias_normalized = 'tomaat' where alias_normalized = 'tomaten' $$,
  'admin can update an alias'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized in ('tomaat', 'tomaten')),
  1,
  'admin update renamed the alias (one row, new name)'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'tomaat'),
  1,
  'the renamed alias is tomaat'
);
select throws_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('bananen', (select id from reference.ingredients where name_nl = 'Banaan' limit 1)) $$,
  '23505',
  null,
  'alias_normalized is unique'
);
select throws_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('', (select id from reference.ingredients where name_nl = 'Banaan' limit 1)) $$,
  '23514',
  null,
  'alias_normalized cannot be empty'
);
select lives_ok(
  $$ delete from reference.ingredient_aliases where alias_normalized = 'tomaat' $$,
  'admin can delete an alias'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'tomaat'),
  0,
  'the deleted alias is gone'
);

-- ---- anon -------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{}';
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'bananen'),
  1,
  'anon can read shared aliases'
);
select throws_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('sneaky', (select id from reference.ingredients where name_nl = 'Banaan' limit 1)) $$,
  '42501',
  null,
  'anon cannot insert an alias'
);
select throws_ok(
  $$ update reference.ingredient_aliases set alias_normalized = 'hacked' $$,
  '42501',
  null,
  'anon cannot update an alias'
);
select throws_ok(
  $$ delete from reference.ingredient_aliases $$,
  '42501',
  null,
  'anon cannot delete an alias'
);
select throws_ok(
  $$ select public.is_admin() $$,
  '42501',
  null,
  'anon cannot execute is_admin()'
);

select * from finish();
rollback;
