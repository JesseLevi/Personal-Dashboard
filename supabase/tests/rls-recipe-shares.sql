-- #465 (ADR-0036): sharing a recipe sends a copy. Roles: owner (O), invitee
-- (M), second invitee (S). Covers the shares columns and policies for recipe
-- rows, pending_recipe_shares(), accept_recipe_share() and that the baskets
-- RPC stays baskets-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-465000000001', 'o@test.local'),
       ('00000000-0000-0000-0000-465000000002', 'm@test.local'),
       ('00000000-0000-0000-0000-465000000003', 's@test.local');
update public.profiles set display_name = 'Olga' where id = '00000000-0000-0000-0000-465000000001';
update public.profiles set display_name = 'Mo' where id = '00000000-0000-0000-0000-465000000002';
update public.profiles set display_name = 'Sam' where id = '00000000-0000-0000-0000-465000000003';

insert into reference.ingredients (id, name_nl, source, source_version)
values ('00000000-0000-0000-0000-465000000d01', 'Bloem', 'test', '1');

-- O: a reference-backed row, a self-added row M also has (other casing), and a
-- self-added row M lacks. M: the matching reference row and self-added row.
insert into public.ingredients (id, user_id, reference_id, name, category)
values ('00000000-0000-0000-0000-465000000a01', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000d01', 'Bloem van Olga', 'Bakken'),
       ('00000000-0000-0000-0000-465000000a02', '00000000-0000-0000-0000-465000000001',
        null, 'Zelfgemaakt', 'Saus'),
       ('00000000-0000-0000-0000-465000000a03', '00000000-0000-0000-0000-465000000001',
        null, 'Uniek', null),
       ('00000000-0000-0000-0000-465000000a11', '00000000-0000-0000-0000-465000000002',
        '00000000-0000-0000-0000-465000000d01', 'Mijn bloem', null),
       ('00000000-0000-0000-0000-465000000a12', '00000000-0000-0000-0000-465000000002',
        null, 'ZELFGEMAAKT', null);

-- Recipes sit in each user's first (lowest position) seeded category.
insert into public.recipes (id, user_id, category_id, title, servings, thumbnail_path, time_minutes, position, source_url)
values ('00000000-0000-0000-0000-465000000f01', '00000000-0000-0000-0000-465000000001',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-465000000001'
         order by position limit 1),
        'Pannenkoeken', 2, '00000000-0000-0000-0000-465000000001/recipes/stem1', 30, 1000,
        'https://example.com/p'),
       ('00000000-0000-0000-0000-465000000f02', '00000000-0000-0000-0000-465000000002',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-465000000002'
         order by position limit 1),
        'Eigen recept', 1, null, null, 1000, null),
       ('00000000-0000-0000-0000-465000000f04', '00000000-0000-0000-0000-465000000003',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-465000000003'
         order by position limit 1),
        'Recept van Sam', 1, null, null, 1000, null);

insert into public.recipe_ingredients (id, user_id, recipe_id, ingredient_id, name, quantity, unit, position, group_label, needs_review)
values ('00000000-0000-0000-0000-465000000c01', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', '00000000-0000-0000-0000-465000000a01',
        'Bloem', 200, 'gram', 1000, 'Beslag', false),
       ('00000000-0000-0000-0000-465000000c02', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', '00000000-0000-0000-0000-465000000a02',
        'Saus', 1, 'stuk', 2000, 'Saus', true),
       ('00000000-0000-0000-0000-465000000c03', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', '00000000-0000-0000-0000-465000000a03',
        'Uniek', 2, 'snufje', 3000, null, false),
       ('00000000-0000-0000-0000-465000000c04', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', null,
        'Zout', null, 'naar_smaak', 4000, null, false);
insert into public.recipe_steps (id, user_id, recipe_id, position, instruction)
values ('00000000-0000-0000-0000-465000000e01', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', 1000, 'Meng'),
       ('00000000-0000-0000-0000-465000000e02', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000f01', 2000, 'Bak');
insert into public.recipe_step_ingredients (user_id, step_id, recipe_ingredient_id, position)
values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000e01',
        '00000000-0000-0000-0000-465000000c01', 1000),
       ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000e01',
        '00000000-0000-0000-0000-465000000c02', 2000),
       ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000e02',
        '00000000-0000-0000-0000-465000000c03', 1000),
       ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000e02',
        '00000000-0000-0000-0000-465000000c04', 2000);

insert into public.shopping_lists (id, user_id, name, position)
values ('00000000-0000-0000-0000-465000000b10', '00000000-0000-0000-0000-465000000001', 'Feest', 2000);

-- O offers the recipe to M and S, and a basket to M.
insert into public.shares (id, user_id, member_id, recipe_id)
values ('00000000-0000-0000-0000-465000000b01', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000002', '00000000-0000-0000-0000-465000000f01'),
       ('00000000-0000-0000-0000-465000000b02', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000003', '00000000-0000-0000-0000-465000000f01');
insert into public.shares (id, user_id, member_id, shopping_list_id)
values ('00000000-0000-0000-0000-465000000b03', '00000000-0000-0000-0000-465000000001',
        '00000000-0000-0000-0000-465000000002', '00000000-0000-0000-0000-465000000b10');

select ok(
  not has_function_privilege('anon', 'public.pending_recipe_shares()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.accept_recipe_share(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pending_recipe_shares()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.accept_recipe_share(uuid)', 'EXECUTE'),
  'the recipe share RPCs are executable by authenticated only'
);

set local role authenticated;

-- ============================================================================
-- Owner
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000001", "role": "authenticated"}';

select is((select count(*)::int from public.shares), 3, 'owner sees the shares they sent');
select is_empty(
  $$ select 1 from public.pending_recipe_shares() $$,
  'the owner has no offers of their own'
);
select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b01') $$,
  '42501', null, 'the owner cannot accept an offer made to someone else'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id, status)
     values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000002',
             '00000000-0000-0000-0000-465000000f01', 'accepted') $$,
  '42501', null, 'a recipe share cannot be inserted as accepted'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000002',
             '00000000-0000-0000-0000-465000000f04') $$,
  '42501', null, 'the owner cannot offer a recipe that is not theirs'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000001',
             '00000000-0000-0000-0000-465000000f01') $$,
  '42501', null, 'the owner cannot offer a recipe to themselves'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000002',
             '00000000-0000-0000-0000-465000000f01') $$,
  '23505', null, 'the same recipe cannot be offered to the same member twice'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id, shopping_list_id)
     values ('00000000-0000-0000-0000-465000000001', '00000000-0000-0000-0000-465000000003',
             '00000000-0000-0000-0000-465000000f01', '00000000-0000-0000-0000-465000000b10') $$,
  '23514', null, 'a share points at exactly one resource'
);

-- ============================================================================
-- Invitee M
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000002", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.recipes where id = '00000000-0000-0000-0000-465000000f01' $$,
  'a pending invitee does not see the recipe through recipes'
);
select is_empty(
  $$ select 1 from public.recipe_ingredients where recipe_id = '00000000-0000-0000-0000-465000000f01' $$,
  'a pending invitee does not see its ingredients'
);
select is_empty(
  $$ select 1 from public.recipe_steps where recipe_id = '00000000-0000-0000-0000-465000000f01' $$,
  'a pending invitee does not see its steps'
);
select results_eq(
  $$ select share_id, recipe_id, title, time_minutes, thumbnail_path, inviter_id, inviter_display_name
     from public.pending_recipe_shares() $$,
  $$ values ('00000000-0000-0000-0000-465000000b01'::uuid, '00000000-0000-0000-0000-465000000f01'::uuid,
             'Pannenkoeken'::text, 30, '00000000-0000-0000-0000-465000000001/recipes/stem1'::text,
             '00000000-0000-0000-0000-465000000001'::uuid, 'Olga'::text) $$,
  'pending_recipe_shares returns only the caller''s own offer'
);
select results_eq(
  $$ select share_id, resource_type from public.pending_share_invites() $$,
  $$ values ('00000000-0000-0000-0000-465000000b03'::uuid, 'shopping_list'::text) $$,
  'pending_share_invites keeps returning baskets only'
);
select throws_ok(
  $$ update public.shares set status = 'accepted'
     where id = '00000000-0000-0000-0000-465000000b01' $$,
  '23514', null, 'a recipe share cannot become accepted'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000002', '00000000-0000-0000-0000-465000000003',
             '00000000-0000-0000-0000-465000000f01') $$,
  '42501', null, 'an invitee cannot offer the recipe onwards'
);

-- ============================================================================
-- Second invitee S: sees only their own offer, cannot take M's
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000003", "role": "authenticated"}';

select results_eq(
  $$ select share_id from public.pending_recipe_shares() $$,
  $$ values ('00000000-0000-0000-0000-465000000b02'::uuid) $$,
  'a stranger to the first offer sees only their own'
);
select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b01') $$,
  '42501', null, 'a stranger cannot accept M''s offer'
);
select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000bff') $$,
  '42501', null, 'accepting an unknown share fails'
);
select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b03') $$,
  '42501', null, 'accepting a basket share through the recipe RPC fails'
);

-- ============================================================================
-- M accepts
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000002", "role": "authenticated"}';

select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b03') $$,
  '42501', null, 'M cannot accept their basket share through the recipe RPC'
);
select results_eq(
  $$ select source_thumbnail_path from public.accept_recipe_share('00000000-0000-0000-0000-465000000b01') $$,
  $$ values ('00000000-0000-0000-0000-465000000001/recipes/stem1'::text) $$,
  'accepting returns the source thumbnail path'
);
select set_config('test.new_id', (
  select id::text from public.recipes
  where user_id = '00000000-0000-0000-0000-465000000002' and title = 'Pannenkoeken'
), true);

select results_eq(
  $$ select user_id, title, servings, time_minutes, thumbnail_path, import_status::text, source_url,
            category_id = (select id from public.recipe_categories
                           where user_id = '00000000-0000-0000-0000-465000000002'
                           order by position limit 1)
     from public.recipes where id = current_setting('test.new_id')::uuid $$,
  $$ values ('00000000-0000-0000-0000-465000000002'::uuid, 'Pannenkoeken'::text, 2, 30, null::text,
             'done'::text, 'https://example.com/p'::text, true) $$,
  'the copy is owned by M, in M''s first category, without a thumbnail'
);
select is(
  (select position from public.recipes where id = current_setting('test.new_id')::uuid),
  500::numeric,
  'the copy sits at the top of the column'
);
select results_eq(
  $$ select name, quantity, unit::text, position, group_label, needs_review
     from public.recipe_ingredients where recipe_id = current_setting('test.new_id')::uuid
     order by position $$,
  $$ values ('Bloem'::text, 200::numeric, 'gram'::text, 1000::numeric, 'Beslag'::text, false),
            ('Saus', 1, 'stuk', 2000, 'Saus', true),
            ('Uniek', 2, 'snufje', 3000, null, false),
            ('Zout', null, 'naar_smaak', 4000, null, false) $$,
  'ingredients are copied with group, review flag and position'
);
select results_eq(
  $$ select name, ingredient_id from public.recipe_ingredients
     where recipe_id = current_setting('test.new_id')::uuid and ingredient_id is not null
       and name <> 'Uniek'
     order by position $$,
  $$ values ('Bloem'::text, '00000000-0000-0000-0000-465000000a11'::uuid),
            ('Saus', '00000000-0000-0000-0000-465000000a12'::uuid) $$,
  'ingredient_id maps to M''s own row by reference_id, or by name for a self-added one'
);
select is(
  (select i.name || '/' || coalesce(i.reference_id::text, 'null')
   from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
   where ri.recipe_id = current_setting('test.new_id')::uuid and ri.name = 'Uniek'),
  'Uniek/null',
  'an ingredient M lacks becomes a new row for M'
);
select is(
  (select count(*)::int from public.ingredients),
  3,
  'M''s library gained exactly one ingredient'
);
select results_eq(
  $$ select instruction, position from public.recipe_steps
     where recipe_id = current_setting('test.new_id')::uuid order by position $$,
  $$ values ('Meng'::text, 1000::numeric), ('Bak', 2000) $$,
  'steps are copied'
);
select results_eq(
  $$ select s.instruction, ri.name, l.position
     from public.recipe_step_ingredients l
     join public.recipe_steps s on s.id = l.step_id
     join public.recipe_ingredients ri on ri.id = l.recipe_ingredient_id and ri.recipe_id = s.recipe_id
     where s.recipe_id = current_setting('test.new_id')::uuid
     order by s.position, l.position $$,
  $$ values ('Meng'::text, 'Bloem'::text, 1000::numeric), ('Meng', 'Saus', 2000),
            ('Bak', 'Uniek', 1000), ('Bak', 'Zout', 2000) $$,
  'step-ingredient links point at the copied ingredients'
);
select is_empty(
  $$ select 1 from public.pending_recipe_shares() $$,
  'the accepted offer is gone from the list'
);
select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b01') $$,
  '42501', null, 'a second accept of the same offer fails'
);
select is(
  (select count(*)::int from public.recipes where title = 'Pannenkoeken'),
  1,
  'a failed second accept makes no second copy'
);

-- ============================================================================
-- Afterwards: the recipes are unrelated
-- ============================================================================
reset role;
select is(
  (select count(*)::int from public.recipe_ingredients ri
   where ri.recipe_id = current_setting('test.new_id')::uuid
     and (ri.user_id <> '00000000-0000-0000-0000-465000000002'
          or ri.ingredient_id in ('00000000-0000-0000-0000-465000000a01',
                                  '00000000-0000-0000-0000-465000000a02',
                                  '00000000-0000-0000-0000-465000000a03'))),
  0,
  'the copy references none of the sender''s rows'
);
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '00000000-0000-0000-0000-465000000f01'),
  4,
  'the source recipe is untouched'
);
select is(
  (select count(*)::int from public.shares where id = '00000000-0000-0000-0000-465000000b01'),
  0,
  'accepting deleted the share'
);

-- ============================================================================
-- S: no category, then decline; owner re-invites and withdraws; cascade
-- ============================================================================
delete from public.recipe_categories where user_id = '00000000-0000-0000-0000-465000000003';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000003", "role": "authenticated"}';

select throws_ok(
  $$ select public.accept_recipe_share('00000000-0000-0000-0000-465000000b02') $$,
  'P0001', null, 'accepting without any recipe category fails'
);
select is(
  (select count(*)::int from public.shares where id = '00000000-0000-0000-0000-465000000b02'),
  1,
  'a failed accept leaves the offer in place'
);
select isnt_empty(
  $$ delete from public.shares where id = '00000000-0000-0000-0000-465000000b02' returning id $$,
  'the invitee declines by deleting the share'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-465000000001", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.shares (id, user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000b04', '00000000-0000-0000-0000-465000000001',
             '00000000-0000-0000-0000-465000000003', '00000000-0000-0000-0000-465000000f01') $$,
  'the owner can offer again after a decline'
);
select isnt_empty(
  $$ delete from public.shares where id = '00000000-0000-0000-0000-465000000b04' returning id $$,
  'the owner can withdraw an offer'
);
select lives_ok(
  $$ insert into public.shares (id, user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-465000000b05', '00000000-0000-0000-0000-465000000001',
             '00000000-0000-0000-0000-465000000003', '00000000-0000-0000-0000-465000000f01') $$,
  'the owner offers once more'
);
select isnt_empty(
  $$ delete from public.recipes where id = '00000000-0000-0000-0000-465000000f01' returning id $$,
  'the owner deletes the recipe'
);

reset role;
select is(
  (select count(*)::int from public.shares where recipe_id = '00000000-0000-0000-0000-465000000f01'),
  0,
  'deleting the recipe cascades its pending offers'
);
select is(
  (select count(*)::int from public.recipes where id = current_setting('test.new_id')::uuid),
  1,
  'M''s copy survives the owner deleting the original'
);

-- ============================================================================
-- Anonymous
-- ============================================================================
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select * from public.pending_recipe_shares() $$,
  '42501', null, 'anon cannot call pending_recipe_shares'
);

select * from finish();
rollback;
