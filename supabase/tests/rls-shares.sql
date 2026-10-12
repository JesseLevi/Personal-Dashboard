-- #423 (ADR-0035): role matrix for shares, shopping_lists and
-- shopping_list_items. Roles: owner (O), accepted editor (E), pending
-- invitee (P), stranger (S). Policies decide access through
-- private.shopping_list_role(); the item trigger rewrites user_id to the list
-- owner, so inserts by an editor must pass on list_id.
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-423000000001', 'o@test.local'),
       ('00000000-0000-0000-0000-423000000002', 'e@test.local'),
       ('00000000-0000-0000-0000-423000000003', 'p@test.local'),
       ('00000000-0000-0000-0000-423000000004', 's@test.local');

insert into public.shopping_lists (id, user_id, name, position)
values ('00000000-0000-0000-0000-423000000f01', '00000000-0000-0000-0000-423000000001', 'Feest', 2000);
insert into public.shopping_list_items (id, user_id, list_id, name, position)
values ('00000000-0000-0000-0000-423000000a01', '00000000-0000-0000-0000-423000000001',
        '00000000-0000-0000-0000-423000000f01', 'Chips', 1000),
       ('00000000-0000-0000-0000-423000000a02', '00000000-0000-0000-0000-423000000001',
        '00000000-0000-0000-0000-423000000f01', 'Cola', 2000);
insert into public.shares (id, user_id, member_id, shopping_list_id, status)
values ('00000000-0000-0000-0000-423000000b01', '00000000-0000-0000-0000-423000000001',
        '00000000-0000-0000-0000-423000000002', '00000000-0000-0000-0000-423000000f01', 'accepted'),
       ('00000000-0000-0000-0000-423000000b02', '00000000-0000-0000-0000-423000000001',
        '00000000-0000-0000-0000-423000000003', '00000000-0000-0000-0000-423000000f01', 'pending');

select set_config('test.o_default', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-423000000001' and is_default), true);
select set_config('test.s_default', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-423000000004' and is_default), true);

select ok(
  not has_function_privilege('anon', 'private.shopping_list_role(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.shares_with(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.shopping_list_role(uuid)', 'EXECUTE'),
  'the role functions are not executable by anon'
);

set local role authenticated;

-- ============================================================================
-- Owner
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000000001", "role": "authenticated"}';

select is((select count(*)::int from public.shopping_lists), 2, 'owner sees their lists');
select is((select count(*)::int from public.shopping_list_items), 2, 'owner sees the items');
select is((select count(*)::int from public.shares), 2, 'owner sees the shares they sent');
select lives_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000f01', 'Ijs', 3000) $$,
  'owner can add an item'
);
select lives_ok(
  $$ update public.shopping_lists set name = 'Verjaardag'
     where id = '00000000-0000-0000-0000-423000000f01' $$,
  'owner can rename the list'
);
select lives_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000004',
             '00000000-0000-0000-0000-423000000f01') $$,
  'owner can invite (defaults to pending/editor)'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id, status)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000004',
             current_setting('test.o_default')::uuid, 'accepted') $$,
  '42501', null, 'owner cannot insert a share as accepted'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000001',
             current_setting('test.o_default')::uuid) $$,
  '42501', null, 'owner cannot invite themselves'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000002',
             current_setting('test.s_default')::uuid) $$,
  '42501', null, 'owner cannot invite to a list that is not theirs'
);
select is_empty(
  $$ update public.shares set status = 'accepted'
     where id = '00000000-0000-0000-0000-423000000b02' returning id $$,
  'owner cannot accept a share on behalf of the invitee'
);
select throws_ok(
  $$ update public.shopping_lists set is_default = false $$,
  '42501', null, 'owner cannot flip is_default'
);
select is_empty(
  $$ delete from public.shopping_lists where is_default returning id $$,
  'owner cannot delete the default list'
);

-- ============================================================================
-- Pending invitee
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000000003", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.shopping_lists where id = '00000000-0000-0000-0000-423000000f01' $$,
  'pending invitee does not see the list'
);
select is_empty(
  $$ select 1 from public.shopping_list_items where list_id = '00000000-0000-0000-0000-423000000f01' $$,
  'pending invitee reads no items'
);
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000003', '00000000-0000-0000-0000-423000000f01', 'sneaky', 1) $$,
  '42501', null, 'pending invitee cannot add items'
);
select is_empty(
  $$ update public.shopping_list_items set checked = true
     where list_id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'pending invitee cannot update items'
);
select is_empty(
  $$ delete from public.shopping_list_items
     where list_id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'pending invitee cannot delete items'
);
select is((select count(*)::int from public.shares), 1, 'pending invitee sees only their own share');
select is_empty(
  $$ update public.shares set status = 'accepted'
     where shopping_list_id = '00000000-0000-0000-0000-423000000f01'
       and member_id = '00000000-0000-0000-0000-423000000004' returning id $$,
  'an invitee cannot accept someone else''s share'
);
select throws_ok(
  $$ update public.shares set role = 'editor' where member_id = '00000000-0000-0000-0000-423000000003' $$,
  '42501', null, 'a member cannot change role'
);
select throws_ok(
  $$ update public.shares set member_id = '00000000-0000-0000-0000-423000000004'
     where member_id = '00000000-0000-0000-0000-423000000003' $$,
  '42501', null, 'a member cannot change member_id'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000003',
             current_setting('test.o_default')::uuid) $$,
  '42501', null, 'a member cannot add themselves to a list'
);
select isnt_empty(
  $$ update public.shares set status = 'accepted', responded_at = now()
     where member_id = '00000000-0000-0000-0000-423000000003' returning id $$,
  'an invitee accepts their own share'
);
select is_empty(
  $$ update public.shares set status = 'pending'
     where member_id = '00000000-0000-0000-0000-423000000003' returning id $$,
  'accepting cannot be undone through update'
);
select is(
  (select count(*)::int from public.shopping_list_items
   where list_id = '00000000-0000-0000-0000-423000000f01'),
  3,
  'after accepting, the invitee reads the items'
);

-- ============================================================================
-- Accepted editor
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.shopping_lists where id = '00000000-0000-0000-0000-423000000f01'),
  1,
  'editor reads the shared list'
);
select is(
  (select count(*)::int from public.shopping_list_items
   where list_id = '00000000-0000-0000-0000-423000000f01'),
  3,
  'editor reads the items'
);
select lives_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000002', '00000000-0000-0000-0000-423000000f01', 'Kaas', 4000) $$,
  'editor can add an item'
);
select is(
  (select user_id from public.shopping_list_items where name = 'Kaas'),
  '00000000-0000-0000-0000-423000000001'::uuid,
  'an item added by an editor carries the owner as user_id'
);
select isnt_empty(
  $$ update public.shopping_list_items set checked = true
     where id = '00000000-0000-0000-0000-423000000a01' returning id $$,
  'editor can tick off an item'
);
select throws_ok(
  $$ update public.shopping_list_items set list_id = current_setting('test.o_default')::uuid
     where id = '00000000-0000-0000-0000-423000000a01' $$,
  '42501', null, 'editor cannot move an item to a list they have no access to'
);
select isnt_empty(
  $$ delete from public.shopping_list_items
     where id = '00000000-0000-0000-0000-423000000a02' returning id $$,
  'editor can delete an item'
);
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000002', current_setting('test.s_default')::uuid, 'sneaky', 1) $$,
  '42501', null, 'editor cannot add an item to a list that is not shared with them'
);
select is_empty(
  $$ update public.shopping_lists set name = 'gekaapt'
     where id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'editor cannot rename the list'
);
select is_empty(
  $$ delete from public.shopping_lists
     where id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'editor cannot delete the list'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000002', '00000000-0000-0000-0000-423000000004',
             '00000000-0000-0000-0000-423000000f01') $$,
  '42501', null, 'editor cannot invite others'
);
select is((select count(*)::int from public.shares), 1, 'editor sees only their own share');
select is_empty(
  $$ update public.shares set status = 'accepted'
     where member_id = '00000000-0000-0000-0000-423000000002' returning id $$,
  'an accepted share cannot be updated again'
);
select is_empty(
  $$ delete from public.shares where member_id = '00000000-0000-0000-0000-423000000004' returning id $$,
  'editor cannot delete another member''s share'
);
select isnt_empty(
  $$ delete from public.shares where member_id = '00000000-0000-0000-0000-423000000002' returning id $$,
  'editor can leave'
);
select is_empty(
  $$ select 1 from public.shopping_list_items
     where list_id = '00000000-0000-0000-0000-423000000f01' $$,
  'after leaving, the editor reads no items'
);
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000002', '00000000-0000-0000-0000-423000000f01', 'weer', 1) $$,
  '42501', null, 'after leaving, the editor cannot add items'
);

-- ============================================================================
-- Stranger
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000000004", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.shopping_lists where id = '00000000-0000-0000-0000-423000000f01' $$,
  'stranger does not see the list'
);
select is_empty(
  $$ select 1 from public.shopping_list_items where list_id = '00000000-0000-0000-0000-423000000f01' $$,
  'stranger reads no items'
);
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-423000000004', '00000000-0000-0000-0000-423000000f01', 'sneaky', 1) $$,
  '42501', null, 'stranger cannot add items to a foreign list'
);
select is_empty(
  $$ update public.shopping_list_items set checked = true
     where list_id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'stranger cannot update items'
);
select is_empty(
  $$ delete from public.shopping_list_items
     where list_id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'stranger cannot delete items'
);
select is_empty(
  $$ update public.shopping_lists set name = 'gekaapt'
     where id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'stranger cannot update the list'
);
select is_empty(
  $$ delete from public.shopping_lists
     where id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'stranger cannot delete the list'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000004', '00000000-0000-0000-0000-423000000004',
             '00000000-0000-0000-0000-423000000f01') $$,
  '42501', null, 'stranger cannot add themselves to a list'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000001', '00000000-0000-0000-0000-423000000004',
             '00000000-0000-0000-0000-423000000f01') $$,
  '42501', null, 'stranger cannot forge an invitation in the owner''s name'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-423000000004', '00000000-0000-0000-0000-423000000001',
             '00000000-0000-0000-0000-423000000f01') $$,
  '42501', null, 'stranger cannot invite others to a foreign list'
);
select is_empty(
  $$ delete from public.shares
     where shopping_list_id = '00000000-0000-0000-0000-423000000f01'
       and member_id = '00000000-0000-0000-0000-423000000003' returning id $$,
  'stranger cannot delete other people''s shares'
);

-- ============================================================================
-- Owner again: revoke, delete the list
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000000001", "role": "authenticated"}';

select isnt_empty(
  $$ delete from public.shares where member_id = '00000000-0000-0000-0000-423000000004' returning id $$,
  'owner can revoke a share'
);
select isnt_empty(
  $$ delete from public.shopping_lists
     where id = '00000000-0000-0000-0000-423000000f01' returning id $$,
  'owner can delete a non-default list'
);

reset role;
select is(
  (select count(*)::int from public.shares where shopping_list_id = '00000000-0000-0000-0000-423000000f01'),
  0,
  'deleting a list cascades to its shares'
);

-- ============================================================================
-- Anonymous
-- ============================================================================
set local role anon;
set local request.jwt.claims to '{}';
select is_empty($$ select id from public.shopping_lists $$, 'anon sees no lists');
select is_empty($$ select id from public.shopping_list_items $$, 'anon sees no items');
select throws_ok($$ select id from public.shares $$, '42501', null, 'anon has no access to shares');

select * from finish();
rollback;
