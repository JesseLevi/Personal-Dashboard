-- Admin writes on reference.ingredients and reference.ingredient_unit_masses
-- (#322, ADR-0020 §2/§4). Admin = authenticated role whose JWT carries
-- app_metadata.role = 'admin'. An admin may insert/update/delete rows with
-- source = 'eigen' only; NEVO/USDA rows are neither editable nor deletable,
-- and no row may be relabelled to or from 'eigen'.
--
-- RLS behaviour asserted here: a blocked INSERT or an UPDATE whose new row
-- fails the with-check raises 42501; an UPDATE/DELETE on a row hidden by
-- the using-clause is silently zero rows (lives_ok + an unchanged-state
-- check). Non-admin refusals for the non-eigen seed rows live in
-- rls-reference-ingredients.sql / rls-reference-ingredient-unit-masses.sql;
-- the shared-alias table is covered by rls-reference-ingredient-aliases.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000033a', 'admin@test.local'),
       ('00000000-0000-0000-0000-00000000033b', 'user@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000033a", "role": "authenticated", "app_metadata": {"role": "admin"}}';

-- ---- admin: reference.ingredients -------------------------------------------
select lives_ok(
  $$ insert into reference.ingredients (name_nl, nutrient_basis, source, source_version)
     values ('Eigen test', 'per_100g', 'eigen', '2026-10-10') $$,
  'admin can insert an eigen ingredient'
);
select throws_ok(
  $$ insert into reference.ingredients (name_nl, nutrient_basis, source, source_version)
     values ('Nep NEVO', 'per_100g', 'NEVO-online', '2025/9.0') $$,
  '42501',
  null,
  'admin cannot insert a non-eigen ingredient'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'Eigen test edited' where name_nl = 'Eigen test' $$,
  'admin can update an eigen ingredient'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Eigen test edited' and source = 'eigen'),
  1,
  'the eigen ingredient was renamed'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where name_nl = 'Banaan' $$,
  'admin update of a NEVO row is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'hacked'),
  0,
  'the NEVO row was not renamed'
);
select lives_ok(
  $$ delete from reference.ingredients where name_nl = 'Banaan' $$,
  'admin delete of a NEVO row is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Banaan' and source <> 'eigen'),
  1,
  'the NEVO Banaan row is still present'
);
select lives_ok(
  $$ update reference.ingredients set source = 'eigen' where name_nl = 'Banaan' $$,
  'admin relabelling a NEVO row as eigen is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Banaan' and source = 'eigen'),
  0,
  'the NEVO row was not relabelled as eigen'
);
select throws_ok(
  $$ update reference.ingredients set source = 'NEVO-online' where name_nl = 'Eigen test edited' $$,
  '42501',
  null,
  'admin cannot relabel an eigen row as another source'
);

-- ---- admin: reference.ingredient_unit_masses --------------------------------
select lives_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Eigen test edited'), 'stuk', 50, 'eigen', '2026-10-10') $$,
  'admin can insert an eigen unit mass'
);
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Eigen test edited'), 'cup', 50, 'NEVO-portie-online', '2025/9.0') $$,
  '42501',
  null,
  'admin cannot insert a non-eigen unit mass'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 55 where source = 'eigen' $$,
  'admin can update an eigen unit mass'
);
select is(
  (select grams::numeric from reference.ingredient_unit_masses where source = 'eigen'),
  55::numeric,
  'the eigen unit mass was updated'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 999 where source <> 'eigen' $$,
  'admin update of NEVO/USDA unit masses is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredient_unit_masses where grams = 999),
  0,
  'no NEVO/USDA unit mass was changed'
);
select lives_ok(
  $$ delete from reference.ingredient_unit_masses where source <> 'eigen' $$,
  'admin delete of NEVO/USDA unit masses is filtered by RLS: no error, zero rows'
);
select ok(
  (select count(*) > 1000 from reference.ingredient_unit_masses where source <> 'eigen'),
  'the NEVO/USDA unit masses are all still present'
);
select throws_ok(
  $$ update reference.ingredient_unit_masses set source = 'NEVO-portie-online' where source = 'eigen' $$,
  '42501',
  null,
  'admin cannot relabel an eigen unit mass as another source'
);

-- ---- non-admin authenticated: eigen rows ------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000033b", "role": "authenticated"}';
select throws_ok(
  $$ insert into reference.ingredients (name_nl, nutrient_basis, source, source_version)
     values ('Sneaky eigen', 'per_100g', 'eigen', '2026-10-10') $$,
  '42501',
  null,
  'non-admin cannot insert an eigen ingredient'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where name_nl = 'Eigen test edited' $$,
  'non-admin update of an eigen ingredient is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredients where name_nl = 'Eigen test edited' $$,
  'non-admin delete of an eigen ingredient is filtered by RLS: no error, zero rows'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Eigen test edited' and source = 'eigen'),
  1,
  'the eigen ingredient is unchanged after non-admin write attempts'
);
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where name_nl = 'Eigen test edited'), 'cup', 1, 'eigen', '2026-10-10') $$,
  '42501',
  null,
  'non-admin cannot insert an eigen unit mass'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 1 where source = 'eigen' $$,
  'non-admin update of an eigen unit mass is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredient_unit_masses where source = 'eigen' $$,
  'non-admin delete of an eigen unit mass is filtered by RLS: no error, zero rows'
);
select is(
  (select grams::numeric from reference.ingredient_unit_masses where source = 'eigen'),
  55::numeric,
  'the eigen unit mass is unchanged after non-admin write attempts'
);

-- ---- admin: delete + cascade ------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000033a", "role": "authenticated", "app_metadata": {"role": "admin"}}';
select lives_ok(
  $$ insert into reference.ingredient_aliases (alias_normalized, ingredient_id)
     values ('eigentest', (select id from reference.ingredients where name_nl = 'Eigen test edited')) $$,
  'admin can alias an eigen ingredient'
);
select lives_ok(
  $$ delete from reference.ingredients where name_nl = 'Eigen test edited' $$,
  'admin can delete an eigen ingredient'
);
select is(
  (select count(*)::int from reference.ingredients where name_nl = 'Eigen test edited'),
  0,
  'the eigen ingredient is gone'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized = 'eigentest')
  + (select count(*)::int from reference.ingredient_unit_masses where source = 'eigen'),
  0,
  'deleting an eigen ingredient cascades to its aliases and unit masses'
);

select * from finish();
rollback;
