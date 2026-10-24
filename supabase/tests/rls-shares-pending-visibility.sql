-- ADR-0035 amendment (2026-10-24): a profile is shown only to people you share
-- with. A pending share shows the inviter to the invitee; the invitee's
-- profile follows only once the share is accepted. Recipe offers follow the
-- same rule. New shares are limited: 20 per user per hour and at most 20 open
-- (pending) ones, enforced by a trigger on public.shares.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- A inviter, B invitee (basket), C recipe-offer recipient, D stranger.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-424000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-424000000002', 'b@test.local'),
       ('00000000-0000-0000-0000-424000000003', 'c@test.local'),
       ('00000000-0000-0000-0000-424000000004', 'd@test.local');
update public.profiles set display_name = 'Anna', last_name = 'Jansen',
  avatar_path = '00000000-0000-0000-0000-424000000001/avatar/a.webp'
  where id = '00000000-0000-0000-0000-424000000001';
update public.profiles set display_name = 'Bob', last_name = 'Bakker',
  avatar_path = '00000000-0000-0000-0000-424000000002/avatar/b.webp'
  where id = '00000000-0000-0000-0000-424000000002';
update public.profiles set display_name = 'Carla', last_name = 'Claes',
  avatar_path = '00000000-0000-0000-0000-424000000003/avatar/c.webp'
  where id = '00000000-0000-0000-0000-424000000003';

select set_config('test.a_list', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-424000000001' and is_default), true);
insert into public.recipes (id, user_id, category_id, title, servings, position)
values ('00000000-0000-0000-0000-424000000f01', '00000000-0000-0000-0000-424000000001',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-424000000001'
         order by position limit 1), 'Soep', 2, 1000);

-- Structure (as the test owner).
select is(
  (select relrowsecurity from pg_class where oid = 'private.share_invite_events'::regclass),
  true,
  'share_invite_events has RLS enabled'
);
select has_column('private', 'share_invite_events', 'user_id', 'share_invite_events carries user_id');
select ok(
  not has_table_privilege('authenticated', 'private.share_invite_events', 'SELECT')
  and not has_table_privilege('authenticated', 'private.share_invite_events', 'INSERT')
  and not has_table_privilege('anon', 'private.share_invite_events', 'SELECT'),
  'share_invite_events has no client grants'
);
select ok(
  not has_function_privilege('authenticated', 'private.limit_share_inserts()', 'EXECUTE')
  and not has_function_privilege('anon', 'private.limit_share_inserts()', 'EXECUTE'),
  'the limit trigger function is not executable by clients'
);

set local role authenticated;

-- ============================================================================
-- Basket invite: A -> B, pending
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000001", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000001', '00000000-0000-0000-0000-424000000002',
             current_setting('test.a_list')::uuid) $$,
  'A invites B'
);
select is_empty(
  $$ select 1 from public.member_profiles(array['00000000-0000-0000-0000-424000000002']::uuid[]) $$,
  'pending: the inviter gets no profile of the invitee'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000002'),
  null,
  'pending: the inviter gets no photo of the invitee'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000001'),
  '00000000-0000-0000-0000-424000000001/avatar/a.webp',
  'A still gets their own photo'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000002", "role": "authenticated"}';
select results_eq(
  $$ select display_name, last_name, has_avatar
     from public.member_profiles(array['00000000-0000-0000-0000-424000000001']::uuid[]) $$,
  $$ values ('Anna'::text, 'Jansen'::text, true) $$,
  'pending: the invitee sees the inviter''s name and photo flag'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000001'),
  '00000000-0000-0000-0000-424000000001/avatar/a.webp',
  'pending: the invitee gets the inviter''s photo'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000004", "role": "authenticated"}';
select is_empty(
  $$ select 1 from public.member_profiles(array['00000000-0000-0000-0000-424000000001',
     '00000000-0000-0000-0000-424000000002']::uuid[]) $$,
  'a stranger gets no profiles'
);
select is(public.avatar_path_for('00000000-0000-0000-0000-424000000001'), null, 'a stranger gets no photo');

-- Accepted: both directions.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000002", "role": "authenticated"}';
select lives_ok(
  $$ update public.shares set status = 'accepted', responded_at = now()
     where member_id = '00000000-0000-0000-0000-424000000002' $$,
  'B accepts'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000001'),
  '00000000-0000-0000-0000-424000000001/avatar/a.webp',
  'accepted: B still sees A'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000001", "role": "authenticated"}';
select results_eq(
  $$ select display_name, last_name, has_avatar
     from public.member_profiles(array['00000000-0000-0000-0000-424000000002']::uuid[]) $$,
  $$ values ('Bob'::text, 'Bakker'::text, true) $$,
  'accepted: the inviter now sees the member''s name and photo flag'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000002'),
  '00000000-0000-0000-0000-424000000002/avatar/b.webp',
  'accepted: the inviter now gets the member''s photo'
);

-- ============================================================================
-- Recipe offer: A -> C (an offer stays pending; it is never an accepted share)
-- ============================================================================
select lives_ok(
  $$ insert into public.shares (user_id, member_id, recipe_id)
     values ('00000000-0000-0000-0000-424000000001', '00000000-0000-0000-0000-424000000003',
             '00000000-0000-0000-0000-424000000f01') $$,
  'A offers a recipe to C'
);
select is_empty(
  $$ select 1 from public.member_profiles(array['00000000-0000-0000-0000-424000000003']::uuid[]) $$,
  'recipe offer: the sender gets no profile of the recipient'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000003'),
  null,
  'recipe offer: the sender gets no photo of the recipient'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000003", "role": "authenticated"}';
select results_eq(
  $$ select display_name from public.member_profiles(array['00000000-0000-0000-0000-424000000001']::uuid[]) $$,
  $$ values ('Anna'::text) $$,
  'recipe offer: the recipient sees the sender'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-424000000001'),
  '00000000-0000-0000-0000-424000000001/avatar/a.webp',
  'recipe offer: the recipient gets the sender''s photo'
);

-- ============================================================================
-- Limits
-- ============================================================================
reset role;
-- Twenty invitees for the limit tests.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-4240001' || lpad(g::text, 5, '0'))::uuid, 'm' || g || '@test.local'
from generate_series(1, 20) g;
-- X: sends 20 in an hour; Y: at the open-invitation cap; Z: only old events.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-424000000011', 'x@test.local'),
       ('00000000-0000-0000-0000-424000000012', 'y@test.local'),
       ('00000000-0000-0000-0000-424000000013', 'z@test.local');
select set_config('test.x_list', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-424000000011' and is_default), true);
select set_config('test.y_list', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-424000000012' and is_default), true);
select set_config('test.z_list', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-424000000013' and is_default), true);

-- Y: 20 pending shares, their events backdated so only the cap applies.
insert into public.shares (user_id, member_id, shopping_list_id)
select '00000000-0000-0000-0000-424000000012',
       ('00000000-0000-0000-0000-4240001' || lpad(g::text, 5, '0'))::uuid,
       current_setting('test.y_list')::uuid
from generate_series(1, 20) g;
update private.share_invite_events set created_at = now() - interval '2 hours'
  where user_id = '00000000-0000-0000-0000-424000000012';

-- Z: 20 events older than an hour, no pending shares.
insert into private.share_invite_events (user_id, created_at)
select '00000000-0000-0000-0000-424000000013', now() - interval '2 hours'
from generate_series(1, 20);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000011", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     select '00000000-0000-0000-0000-424000000011',
            ('00000000-0000-0000-0000-4240001' || lpad(g::text, 5, '0'))::uuid,
            current_setting('test.x_list')::uuid
     from generate_series(1, 20) g $$,
  'X can send 20 invitations in an hour'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000011', '00000000-0000-0000-0000-424000000004',
             current_setting('test.x_list')::uuid) $$,
  'P0001', 'share_limit', 'the 21st invitation within an hour is refused'
);

-- Withdrawing invitations does not free the hourly allowance.
select lives_ok(
  $$ delete from public.shares where user_id = '00000000-0000-0000-0000-424000000011' $$,
  'X withdraws all open invitations'
);
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000011', '00000000-0000-0000-0000-424000000004',
             current_setting('test.x_list')::uuid) $$,
  'P0001', 'share_limit', 'withdrawing invitations does not reset the hourly limit'
);

-- Y: open-invitation cap.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000012", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000012', '00000000-0000-0000-0000-424000000004',
             current_setting('test.y_list')::uuid) $$,
  'P0001', 'share_limit', 'the 21st open invitation is refused'
);
select lives_ok(
  $$ delete from public.shares where member_id = '00000000-0000-0000-0000-424000100001' $$,
  'Y withdraws an open invitation'
);
select lives_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000012', '00000000-0000-0000-0000-424000000004',
             current_setting('test.y_list')::uuid) $$,
  'Y can invite again once below the cap'
);

-- Z: events older than an hour do not count.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-424000000013", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.shares (user_id, member_id, shopping_list_id)
     values ('00000000-0000-0000-0000-424000000013', '00000000-0000-0000-0000-424000000004',
             current_setting('test.z_list')::uuid) $$,
  'events older than an hour do not count'
);
select throws_ok(
  $$ select * from private.share_invite_events $$,
  '42501', null, 'authenticated cannot read the events table'
);

reset role;
select is(
  (select count(*)::int from private.share_invite_events
   where user_id = '00000000-0000-0000-0000-424000000011'),
  20,
  'rejected inserts record nothing: X has exactly 20 events'
);
select is(
  (select count(*)::int from private.share_invite_events
   where user_id = '00000000-0000-0000-0000-424000000001'),
  2,
  'A has one event per share created (basket and recipe offer)'
);
select is(
  (select count(*)::int from private.share_invite_events
   where created_at < now() - interval '1 hour'),
  0,
  'old events are purged on the next insert'
);

select * from finish();
rollback;
