-- #423 (ADR-0035 §6): member_profiles, search_members, pending_share_invites
-- and private.member_search_attempts. The attempts table lives outside
-- `public`, so check-rls-coverage.sh does not see it; its isolation is
-- asserted here, like rls-login-greeting.sql does for ADR-0031.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email, deleted_at, banned_until)
values ('00000000-0000-0000-0000-423000006001', 'anna@test.local', null, null),
       ('00000000-0000-0000-0000-423000006002', 'bob@test.local', null, null),
       ('00000000-0000-0000-0000-423000006003', 'carla@test.local', null, null),
       ('00000000-0000-0000-0000-423000006004', 'dirk@test.local', now(), null),
       ('00000000-0000-0000-0000-423000006005', 'erik@test.local', null, now() + interval '1 day'),
       ('00000000-0000-0000-0000-423000006006', 'gina@test.local', null, null),
       ('00000000-0000-0000-0000-423000006007', 'hans@test.local', null, null),
       ('00000000-0000-0000-0000-423000006008', 'iris@test.local', null, null);
update public.profiles set display_name = 'Anna', last_name = 'Jansen'
  where id = '00000000-0000-0000-0000-423000006001';
update public.profiles set display_name = 'Bob', last_name = 'Bakker', avatar_url = 'x'
  where id = '00000000-0000-0000-0000-423000006002';
update public.profiles set display_name = 'Carla', last_name = 'Bakker'
  where id = '00000000-0000-0000-0000-423000006003';
update public.profiles set display_name = 'Dirk', last_name = 'Bakker'
  where id = '00000000-0000-0000-0000-423000006004';
update public.profiles set display_name = 'Erik', last_name = 'Bakker'
  where id = '00000000-0000-0000-0000-423000006005';

-- Ten more people for the result cap.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-42300001' || lpad(g::text, 4, '0'))::uuid,
       'massa' || g || '@test.local'
from generate_series(1, 10) g;
update public.profiles set display_name = 'Massa', last_name = 'Pers'
  where id::text like '00000000-0000-0000-0000-42300001%';

-- Anna shares a list with Bob (pending).
insert into public.shopping_lists (id, user_id, name, position)
values ('00000000-0000-0000-0000-423000006f01', '00000000-0000-0000-0000-423000006001', 'Lijstje', 2000);
insert into public.shares (user_id, member_id, shopping_list_id)
values ('00000000-0000-0000-0000-423000006001', '00000000-0000-0000-0000-423000006002',
        '00000000-0000-0000-0000-423000006f01');

-- Backdated attempts (outside the 15 minute window) must not count.
insert into private.member_search_attempts (key, attempted_at)
select 'user:00000000-0000-0000-0000-423000006008', now() - interval '20 minutes'
from generate_series(1, 40);

-- Grants and structure (as the test owner).
select ok(
  has_function_privilege('authenticated', 'public.member_profiles(uuid[])', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.search_members(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pending_share_invites()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.member_profiles(uuid[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.search_members(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pending_share_invites()', 'EXECUTE'),
  'only authenticated can execute the member RPCs'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in ('public.member_profiles(uuid[])'::regprocedure,
                    'public.search_members(text)'::regprocedure,
                    'public.pending_share_invites()'::regprocedure)
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on the member RPCs'
);
select ok(
  not has_table_privilege('anon', 'private.member_search_attempts', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'private.member_search_attempts', 'SELECT,INSERT,UPDATE,DELETE'),
  'clients have no table privileges on the attempts table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.member_search_attempts'::regclass),
  'RLS is enabled on the attempts table'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'private' and tablename = 'member_search_attempts'),
  'the attempts table has no policies'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006001", "role": "authenticated"}';

select throws_ok(
  $$ select * from private.member_search_attempts $$,
  '42501', null, 'authenticated cannot select the attempts table'
);
select throws_ok(
  $$ insert into private.member_search_attempts (key) values ('x') $$,
  '42501', null, 'authenticated cannot insert into the attempts table'
);

-- ============================================================================
-- member_profiles
-- ============================================================================
select is(
  (select array_agg(id) from public.member_profiles(array[
    '00000000-0000-0000-0000-423000006002', '00000000-0000-0000-0000-423000006003',
    '00000000-0000-0000-0000-423000006001']::uuid[])),
  array['00000000-0000-0000-0000-423000006002']::uuid[],
  'member_profiles returns only users the caller shares with (not unrelated users, not self)'
);
select is(
  (select has_avatar from public.member_profiles(array['00000000-0000-0000-0000-423000006002']::uuid[])),
  true,
  'has_avatar is derived without exposing the path'
);
select is(
  (select last_name from public.member_profiles(array['00000000-0000-0000-0000-423000006002']::uuid[])),
  'Bakker',
  'member_profiles returns the last name'
);
select is(
  (select count(*)::int from public.profiles),
  1,
  'profiles policies are not widened: A still sees only their own profile'
);

-- ============================================================================
-- search_members
-- ============================================================================
select is(
  (select count(*)::int from public.search_members('bakker')),
  2,
  'search finds members by last name, without deleted or banned users'
);
select is(
  (select count(*)::int from public.search_members('jansen')),
  0,
  'search leaves out the caller'
);
select is((select count(*)::int from public.search_members('b')), 0, 'a query below 2 characters returns nothing');
select is(
  (select count(*)::int from public.search_members(repeat('b', 65))),
  0,
  'a query above 64 characters returns nothing'
);
select is(
  (select count(*)::int from public.search_members('BAKKER')),
  2,
  'search ignores case'
);
select is(
  (select count(*)::int from public.search_members('bob bak')),
  1,
  'search matches across first and last name'
);
select is((select count(*)::int from public.search_members('%%')), 0, 'LIKE wildcards are escaped (percent)');
select is((select count(*)::int from public.search_members('__')), 0, 'LIKE wildcards are escaped (underscore)');
select is(
  (select count(*)::int from public.search_members('massa')),
  8,
  'search returns at most 8 results'
);
select is(
  (select email from public.search_members('carla@test.local')),
  'carla@test.local',
  'the e-mail address comes back on an exact e-mail match'
);
select is(
  (select email from public.search_members('Carla@Test.Local')),
  'carla@test.local',
  'an exact e-mail match is case-insensitive'
);
select is(
  (select email from public.search_members('carla')),
  null,
  'a name search never returns the e-mail address'
);
select is(
  (select count(*)::int from public.search_members('carla@test')),
  0,
  'a partial e-mail address finds nobody'
);
select is(
  (select count(*)::int from public.search_members('dirk@test.local')),
  0,
  'an exact e-mail match on a deleted user finds nobody'
);

-- ============================================================================
-- pending_share_invites
-- ============================================================================
select is_empty($$ select 1 from public.pending_share_invites() $$, 'the inviter has no pending invites');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006002", "role": "authenticated"}';
select results_eq(
  $$ select resource_type, resource_name, inviter_display_name, inviter_last_name from public.pending_share_invites() $$,
  $$ values ('shopping_list'::text, 'Lijstje'::text, 'Anna'::text, 'Jansen'::text) $$,
  'the invitee sees the container name and the inviter'
);
select is(
  (select array_agg(id) from public.member_profiles(array['00000000-0000-0000-0000-423000006001']::uuid[])),
  array['00000000-0000-0000-0000-423000006001']::uuid[],
  'member_profiles works in the other direction too'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006003", "role": "authenticated"}';
select is_empty($$ select 1 from public.pending_share_invites() $$, 'a stranger sees no invites');
select is_empty(
  $$ select 1 from public.member_profiles(array['00000000-0000-0000-0000-423000006001',
     '00000000-0000-0000-0000-423000006002']::uuid[]) $$,
  'member_profiles leaks nobody to a user without a share'
);

-- ============================================================================
-- Rate limit: 30 per user, 500 global, per 15 minutes
-- ============================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006006", "role": "authenticated"}';
select lives_ok(
  $$ select count(*) from generate_series(1, 30) g, lateral public.search_members(case when g > 0 then 'bakker' end) $$,
  'thirty searches within the window run'
);
select throws_ok(
  $$ select * from public.search_members('bakker') $$,
  'P0001', 'rate_limited', 'the 31st search is refused'
);

reset role;
select is(
  (select count(*)::int from private.member_search_attempts
   where key = 'user:00000000-0000-0000-0000-423000006006'),
  30,
  'a blocked call records no attempt'
);
set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006007", "role": "authenticated"}';
select is(
  (select count(*)::int from public.search_members('bakker')),
  2,
  'another user is not affected by the first user''s limit'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006008", "role": "authenticated"}';
select is(
  (select count(*)::int from public.search_members('bakker')),
  2,
  'attempts older than 15 minutes do not count'
);

reset role;
insert into private.member_search_attempts (key, attempted_at)
select 'global', now() - interval '5 minutes' from generate_series(1, 500);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-423000006007", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.search_members('bakker') $$,
  'P0001', 'rate_limited', 'at the global limit even a fresh user is refused'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select * from public.search_members('bakker') $$,
  '42501', null, 'anon cannot call search_members'
);
select throws_ok(
  $$ select * from public.member_profiles(array[]::uuid[]) $$,
  '42501', null, 'anon cannot call member_profiles'
);
select throws_ok(
  $$ select * from public.pending_share_invites() $$,
  '42501', null, 'anon cannot call pending_share_invites'
);

select * from finish();
rollback;
