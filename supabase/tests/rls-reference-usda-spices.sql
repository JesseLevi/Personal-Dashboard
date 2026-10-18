-- USDA SR Legacy herbs and spices (#521, ADR-0011 §5, ADR-0020 §2): the rows
-- seeded by 20261018000001_usda_spices.sql exist with their provenance, their
-- shared aliases resolve to the expected rows, and neither an admin nor a
-- non-admin can change or remove them (the admin policies only cover
-- source = 'eigen'). Blocked INSERT raises 42501; UPDATE/DELETE on rows hidden
-- by the using-clause are silently zero rows (lives_ok + unchanged-state).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000052a', 'admin@test.local'),
       ('00000000-0000-0000-0000-00000000052b', 'user@test.local');

-- ---- seed shape (as the postgres superuser) --------------------------------
select is(
  (select count(*)::int from reference.ingredients where source = 'USDA-SR-Legacy'),
  20,
  'all 20 USDA spice rows are seeded'
);
select is(
  (select count(*)::int from reference.ingredients
    where source = 'USDA-SR-Legacy'
      and source_version = '2018-04'
      and source_ref is not null
      and nutrient_basis = 'per_100g'
      and category_nl = 'Kruiden en specerijen'
      and category_en = 'Herbs and spices'),
  20,
  'every USDA row carries source_ref, version, per_100g basis and the spices category pair'
);
select is(
  (select kcal_per_100g::text || '/' || protein_g_per_100g::text from reference.ingredients
    where source = 'USDA-SR-Legacy' and source_ref = '172231'),
  '312/9.68',
  'Kurkuma gemalen carries the SR Legacy numbers (fdc_id 172231)'
);
select is(
  (select grams::text from reference.ingredient_unit_masses um
     join reference.ingredients ri on ri.id = um.ingredient_id
    where ri.source_ref = '172231' and um.unit = 'theelepel'),
  '3',
  'Kurkuma gemalen has a theelepel mass from a food_portion row'
);

-- ---- aliases resolve to the expected rows -----------------------------------
select is(
  (select ri.name_nl from reference.ingredient_aliases a join reference.ingredients ri on ri.id = a.ingredient_id
    where a.alias_normalized = 'kurkuma'),
  'Kurkuma gemalen',
  'alias kurkuma -> Kurkuma gemalen'
);
select is(
  (select ri.name_nl from reference.ingredient_aliases a join reference.ingredients ri on ri.id = a.ingredient_id
    where a.alias_normalized = 'tijm'),
  'Tijm gedroogd',
  'alias tijm -> Tijm gedroogd'
);
select is(
  (select ri.name_nl from reference.ingredient_aliases a join reference.ingredients ri on ri.id = a.ingredient_id
    where a.alias_normalized = 'tijmtakje'),
  'Tijm vers',
  'alias tijmtakje (verse tijmtakjes) -> Tijm vers'
);
select is(
  (select count(*)::int from reference.ingredient_aliases where alias_normalized in ('bakpoeder', 'gember', 'koriander')),
  0,
  'the migration claims neither bakpoeder (admin adds it) nor the bare gember/koriander keys'
);
select is(
  (select ri.name_nl from reference.ingredient_aliases a join reference.ingredients ri on ri.id = a.ingredient_id
    where a.alias_normalized = 'kerriepoeder'),
  'Kerrie djawa',
  'alias kerriepoeder -> the NEVO row Kerrie djawa'
);
select is(
  (select ri.name_nl from reference.ingredient_aliases a join reference.ingredients ri on ri.id = a.ingredient_id
    where a.alias_normalized = 'kruid'),
  'Kruiden tuin- vers gem',
  'alias kruid (verse kruiden) -> the NEVO row Kruiden tuin- vers gem'
);
select is(
  (select count(*)::int from reference.ingredients where source = 'NEVO-online' and source_ref in ('1223', '5415')),
  2,
  'the two aliased NEVO rows still exist, unchanged in count'
);

-- ---- admin cannot touch USDA rows --------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000052a", "role": "authenticated", "app_metadata": {"role": "admin"}}';

select throws_ok(
  $$ insert into reference.ingredients (name_nl, nutrient_basis, source, source_ref, source_version)
     values ('Nep USDA', 'per_100g', 'USDA-SR-Legacy', '1', '2018-04') $$,
  '42501',
  null,
  'admin cannot insert a USDA ingredient'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where source_ref = '172231' and source = 'USDA-SR-Legacy' $$,
  'admin update of a USDA row is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredients where source_ref = '172231' and source = 'USDA-SR-Legacy' $$,
  'admin delete of a USDA row is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ update reference.ingredient_unit_masses set grams = 99
      where ingredient_id = (select id from reference.ingredients where source = 'USDA-SR-Legacy' and source_ref = '172231') $$,
  'admin update of a USDA unit mass is filtered by RLS: no error, zero rows'
);
select throws_ok(
  $$ insert into reference.ingredient_unit_masses (ingredient_id, unit, grams, source, source_version)
     values ((select id from reference.ingredients where source = 'USDA-SR-Legacy' and source_ref = '171324'),
             'cup', 100, 'USDA-SR-Legacy', '2018-04') $$,
  '42501',
  null,
  'admin cannot add a non-eigen unit mass to a USDA row'
);

-- ---- non-admin cannot touch USDA rows -----------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000052b", "role": "authenticated"}';

select throws_ok(
  $$ insert into reference.ingredients (name_nl, nutrient_basis, source, source_ref, source_version)
     values ('Nep USDA', 'per_100g', 'USDA-SR-Legacy', '2', '2018-04') $$,
  '42501',
  null,
  'non-admin cannot insert a USDA ingredient'
);
select lives_ok(
  $$ update reference.ingredients set name_nl = 'hacked' where source_ref = '172231' and source = 'USDA-SR-Legacy' $$,
  'non-admin update of a USDA row is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredients where source_ref = '172231' and source = 'USDA-SR-Legacy' $$,
  'non-admin delete of a USDA row is filtered by RLS: no error, zero rows'
);
select lives_ok(
  $$ delete from reference.ingredient_unit_masses
      where ingredient_id = (select id from reference.ingredients where source = 'USDA-SR-Legacy' and source_ref = '172231') $$,
  'non-admin delete of a USDA unit mass is filtered by RLS: no error, zero rows'
);

-- ---- everything is still there --------------------------------------------------
select is(
  (select name_nl from reference.ingredients where source = 'USDA-SR-Legacy' and source_ref = '172231'),
  'Kurkuma gemalen',
  'the USDA row was neither renamed nor deleted'
);
select is(
  (select grams::text from reference.ingredient_unit_masses um
     join reference.ingredients ri on ri.id = um.ingredient_id
    where ri.source_ref = '172231' and um.unit = 'theelepel'),
  '3',
  'the USDA unit mass is unchanged'
);
select is(
  (select count(*)::int from reference.ingredients where source = 'USDA-SR-Legacy'),
  20,
  'all 20 USDA rows survive'
);
select is(
  (select count(*)::int from reference.ingredient_unit_masses where source = 'USDA-SR-Legacy' and unit in ('theelepel', 'eetlepel')
     and ingredient_id in (select id from reference.ingredients where source_ref = '172231' and source = 'USDA-SR-Legacy')),
  2,
  'Kurkuma gemalen keeps both spoon masses'
);

select * from finish();
rollback;
