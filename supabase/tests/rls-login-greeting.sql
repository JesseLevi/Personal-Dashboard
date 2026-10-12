-- ADR-0031 (#407): login_greeting_name + private.login_greeting_attempts.
-- The attempts table lives outside `public`, so check-rls-coverage.sh does not
-- see it; its isolation is asserted here instead.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, deleted_at, banned_until)
values ('00000000-0000-0000-0000-0000000000c1', 'carlotta@test.local', null, null),
       ('00000000-0000-0000-0000-0000000000c2', 'blank@test.local', null, null),
       ('00000000-0000-0000-0000-0000000000c3', 'backdated@test.local', null, null),
       ('00000000-0000-0000-0000-0000000000c4', 'deleted@test.local', now(), null),
       ('00000000-0000-0000-0000-0000000000c5', 'banned@test.local', null, now() + interval '1 day'),
       ('00000000-0000-0000-0000-0000000000c6', 'globalcheck@test.local', null, null);
update public.profiles set display_name = '  Carlotta Example '
  where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = '   '
  where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set display_name = 'Oldie'
  where id in ('00000000-0000-0000-0000-0000000000c3',
               '00000000-0000-0000-0000-0000000000c4',
               '00000000-0000-0000-0000-0000000000c5');
update public.profiles set display_name = 'Glob'
  where id = '00000000-0000-0000-0000-0000000000c6';

-- Backdated attempts (outside the 15 minute window) must not count.
insert into private.login_greeting_attempts (key, attempted_at)
select v.k, now() - interval '20 minutes'
from generate_series(1, 20) g,
     (values ('ip:ip-old'),
             ('email:' || encode(sha256(convert_to('backdated@test.local', 'UTF8')), 'hex'))) v(k);

-- Grants and structure (as the test owner).
select ok(
  has_function_privilege('anon', 'public.login_greeting_name(text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.login_greeting_name(text, text)', 'EXECUTE'),
  'only anon can execute login_greeting_name'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.login_greeting_name(text,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on login_greeting_name'
);
select ok(
  not has_table_privilege('anon', 'private.login_greeting_attempts', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has no table privileges on the attempts table'
);
select ok(
  not has_table_privilege('authenticated', 'private.login_greeting_attempts', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated has no table privileges on the attempts table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.login_greeting_attempts'::regclass),
  'RLS is enabled on the attempts table'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE')
  and has_schema_privilege('authenticated', 'private', 'USAGE'),
  'anon has no usage on schema private; authenticated has it for the policy functions (#423)'
);

set local role anon;
set local request.jwt.claims to '{}';

select throws_ok(
  $$ select * from private.login_greeting_attempts $$,
  '42501', null, 'anon cannot select private.login_greeting_attempts'
);
select throws_ok(
  $$ insert into private.login_greeting_attempts (key) values ('x') $$,
  '42501', null, 'anon cannot insert into private.login_greeting_attempts'
);

select is(
  public.login_greeting_name('carlotta@test.local', 'ip-a'),
  'Carlotta',
  'returns the first name of the seeded user'
);
select is(public.login_greeting_name('nobody@test.local', 'ip-b'), null,
  'an unknown email returns null');
select is(public.login_greeting_name('blank@test.local', 'ip-c'), null,
  'a blank display_name returns null');
select is(public.login_greeting_name('deleted@test.local', 'ip-g'), null,
  'a deleted user returns null');
select is(public.login_greeting_name('banned@test.local', 'ip-h'), null,
  'a banned user returns null');
select is(public.login_greeting_name(repeat('a', 250) || '@b.nl', 'ip-i'), null,
  'an over-long email returns null');
select is(public.login_greeting_name('carlotta@test.local', repeat('k', 129)), null,
  'an over-long client key returns null');

-- Backdated rows (20 per key) are outside the window and do not count.
select is(
  (select count(*)::int from (
     select public.login_greeting_name('backdated@test.local', 'ip-old') as n
     from generate_series(1, 5) g) s
   where n = 'Oldie'),
  5,
  'attempts older than 15 minutes do not count toward the limits'
);

-- Email limit: 5 allowed per window. Call 1 above used the same address, so
-- 4 more pass and the 6th is refused.
select is(
  (select count(*)::int from (
     select public.login_greeting_name(' Carlotta@Test.Local ', 'ip-d' || g) as n
     from generate_series(1, 4) g) s
   where n = 'Carlotta'),
  4,
  'calls 2-5 for the same email (trimmed, any case) still return the name'
);
select is(public.login_greeting_name('carlotta@test.local', 'ip-e'), null,
  'the 6th call for the same email within the window returns null');

reset role;
select is(
  (select count(*)::int from private.login_greeting_attempts
   where key = 'email:' || encode(sha256(convert_to('carlotta@test.local', 'UTF8')), 'hex')
     and attempted_at > now() - interval '15 minutes'),
  5,
  'a blocked call records no attempt'
);
set local role anon;
set local request.jwt.claims to '{}';

-- IP limit: 10 allowed per window, across different emails.
select is(
  (select count(*)::int from (
     select public.login_greeting_name('user' || g || '@test.local', 'ip-f') as n
     from generate_series(1, 10) g) s),
  10,
  'ten calls for one client key run'
);
select is(public.login_greeting_name('carlotta2@test.local', 'ip-f'), null,
  'the 11th call for the same client key returns null');

-- Global limit: 200 per window. A fresh client and email work first; after
-- the owner fills the window, the same kind of call is refused.
select is(public.login_greeting_name('globalcheck@test.local', 'ip-j'), 'Glob',
  'a fresh client and email get the name below the global limit');
reset role;
insert into private.login_greeting_attempts (key, attempted_at)
select 'global', now() - interval '5 minutes' from generate_series(1, 200);
set local role anon;
set local request.jwt.claims to '{}';
select is(public.login_greeting_name('globalcheck@test.local', 'ip-k'), null,
  'at the global limit even a fresh client key gets null');

select * from finish();
rollback;
