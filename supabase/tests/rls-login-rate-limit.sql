-- public.login_rate_limit + private.login_rate_events. The table lives outside
-- `public`, so check-rls-coverage.sh does not see it; its isolation is asserted here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Grants and structure.
select ok(
  has_function_privilege('anon', 'public.login_rate_limit(text, text, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.login_rate_limit(text, text, text, text)', 'EXECUTE'),
  'only anon can execute login_rate_limit'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.login_rate_limit(text,text,text,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on login_rate_limit'
);
select ok(
  not has_table_privilege('anon', 'private.login_rate_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'private.login_rate_events', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon and authenticated have no table privileges on the events table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.login_rate_events'::regclass),
  'RLS is enabled on the events table'
);

set local role anon;
set local request.jwt.claims to '{}';

select throws_ok($$ select * from private.login_rate_events $$, '42501', null,
  'anon cannot select private.login_rate_events');
select throws_ok($$ insert into private.login_rate_events (key) values ('x') $$, '42501', null,
  'anon cannot insert into private.login_rate_events');

-- Verify: 5 per address, whichever client or session the attempts come from.
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('verify', 'victim@test.local', 'v-ip' || g, 'consume') as ok
     from generate_series(1, 5) g) s),
  5,
  'five verify attempts for one address pass'
);
select is(public.login_rate_limit('verify', ' Victim@Test.Local ', 'v-ip-other', 'consume'), false,
  'the sixth verify attempt for the address is refused, from another client and in any case');
select is(public.login_rate_limit('verify', 'other@test.local', 'v-ip-other', 'consume'), true,
  'another address is unaffected');

reset role;
select is(
  (select count(*)::int from private.login_rate_events
   where key = 'verify|email:' || encode(sha256(convert_to('victim@test.local', 'UTF8')), 'hex')),
  5,
  'a refused call records nothing'
);
set local role anon;
set local request.jwt.claims to '{}';

-- A granted send resets the address's verify counter.
select is(public.login_rate_limit('send', 'victim@test.local', 's-ip1', 'consume'), true,
  'a code send is allowed');
select is(public.login_rate_limit('verify', 'victim@test.local', 'v-ip-new', 'consume'), true,
  'after a new code the address can verify again');

-- Refund after a success frees the slot.
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('verify', 'refund@test.local', 'r-ip', 'consume') as ok
     from generate_series(1, 4) g) s),
  4, 'four verify attempts pass');
select is(public.login_rate_limit('verify', 'refund@test.local', 'r-ip', 'refund'), true,
  'refund succeeds');
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('verify', 'refund@test.local', 'r-ip', 'consume') as ok
     from generate_series(1, 3) g) s),
  2, 'after a refund two more of the five slots are left');

-- Send: 3 per address.
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('send', 'mail@test.local', 'm-ip' || g, 'consume') as ok
     from generate_series(1, 4) g) s),
  3, 'three code sends per address, the fourth is refused');

-- Password: 8 per address; actions are counted separately.
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('password', 'pw@test.local', 'p-ip' || g, 'consume') as ok
     from generate_series(1, 9) g) s),
  8, 'eight password attempts per address, the ninth is refused');
select is(public.login_rate_limit('send', 'pw@test.local', 'p-ip-x', 'consume'), true,
  'password attempts do not count against sends');

-- Per-client limit: 20 password attempts across addresses, then refused.
select is(
  (select count(*) filter (where ok)::int from (
     select public.login_rate_limit('password', 'ipuser' || g || '@test.local', 'one-ip', 'consume') as ok
     from generate_series(1, 21) g) s),
  20, 'twenty password attempts per client, the 21st is refused');
select is(public.login_rate_limit('password', 'victim2@test.local', 'clean-ip', 'consume'), true,
  'filling one client key does not lock out another client or address');

-- Global ceiling; an ancient row is purged by the next call.
reset role;
insert into private.login_rate_events (key, created_at)
select 'send|global', now() - interval '5 minutes' from generate_series(1, 100);
insert into private.login_rate_events (key, created_at)
values ('verify|email:ancient', now() - interval '2 hours');
set local role anon;
set local request.jwt.claims to '{}';
select is(public.login_rate_limit('send', 'fresh@test.local', 'fresh-ip', 'consume'), false,
  'at the global ceiling even a fresh address and client are refused');
select is(public.login_rate_limit('password', 'fresh@test.local', 'fresh-ip', 'consume'), true,
  'the send ceiling does not affect password attempts');

-- Input validation.
select is(public.login_rate_limit('bogus', 'a@test.local', 'k', 'consume'), false,
  'an unknown action is refused');
select is(public.login_rate_limit('send', 'a@test.local', repeat('k', 129), 'consume'), false,
  'an over-long client key is refused');

reset role;
select is((select count(*)::int from private.login_rate_events where key = 'verify|email:ancient'), 0,
  'rows older than an hour are purged');

select * from finish();
rollback;
