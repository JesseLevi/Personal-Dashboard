-- ADR-0031 (#407): public.login_greeting_name() and its private rate-limit
-- table. private.login_greeting_attempts is outside public, so
-- check-rls-coverage.sh does not see it; its isolation is asserted here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Signup trigger creates the profiles; names are set afterwards.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000c1', 'carlotta@test.local'),
       ('00000000-0000-0000-0000-0000000000c2', 'lim@test.local'),
       ('00000000-0000-0000-0000-0000000000c3', 'nameless@test.local');
update public.profiles set display_name = '  Carlotta van Dam ' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Lim' where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-0000000000c3';

-- anon: no access to the attempts table or its schema.
set local role anon;
select throws_ok($$ select * from private.login_greeting_attempts $$, '42501', null,
  'anon cannot select private.login_greeting_attempts');
select throws_ok($$ insert into private.login_greeting_attempts (key) values ('x') $$, '42501', null,
  'anon cannot insert into private.login_greeting_attempts');

-- anon: the RPC works; name, case/whitespace-insensitive email.
select is(public.login_greeting_name(' Carlotta@Test.local ', 'k1'), 'Carlotta',
  'returns the first word of the display name');
select is(public.login_greeting_name('nobody@test.local', 'k2'), null,
  'unknown address returns null');
select is(public.login_greeting_name('nameless@test.local', 'k3'), null,
  'blank display name returns null');
select is(public.login_greeting_name('', 'k4'), null, 'empty address returns null');

-- Email limit: 5 per 15 min, the 6th is null although the user exists.
select lives_ok(
  $$ select public.login_greeting_name('lim@test.local', 'e' || g) from generate_series(1, 4) g $$,
  'four lookups for one address succeed');
select is(public.login_greeting_name('lim@test.local', 'e5'), 'Lim', 'fifth lookup still returns the name');
select is(public.login_greeting_name('lim@test.local', 'e6'), null, 'sixth lookup for the same address returns null');

-- Client-key limit: 10 per 15 min, the 11th is null although the user exists.
select lives_ok(
  $$ select public.login_greeting_name('unknown' || g || '@test.local', 'ipk') from generate_series(1, 10) g $$,
  'ten lookups for one client key succeed');
select is(public.login_greeting_name('carlotta@test.local', 'ipk'), null,
  'eleventh lookup for the same client key returns null');

-- authenticated: no table access, no execute.
reset role;
set local role authenticated;
select throws_ok($$ select * from private.login_greeting_attempts $$, '42501', null,
  'authenticated cannot select private.login_greeting_attempts');
select throws_ok($$ select public.login_greeting_name('carlotta@test.local', 'a1') $$, '42501', null,
  'authenticated cannot execute login_greeting_name');

-- Storage: only hashes, RLS on, no policies.
reset role;
select is((select count(*)::int from private.login_greeting_attempts where key like '%test.local%'), 0,
  'no clear-text address is stored');
select ok((select relrowsecurity from pg_class where oid = 'private.login_greeting_attempts'::regclass),
  'RLS is enabled on the attempts table');
select is((select count(*)::int from pg_policies where schemaname = 'private'), 0,
  'the attempts table has no policies');

-- Global limit: 200 per 15 min.
insert into private.login_greeting_attempts (key) select 'global' from generate_series(1, 200);
set local role anon;
select is(public.login_greeting_name('carlotta@test.local', 'fresh'), null,
  'lookup past the global limit returns null');

select * from finish();
rollback;
