-- ADR-0031 (#407): login_greeting_name + private.login_greeting_attempts.
-- The attempts table lives outside `public`, so check-rls-coverage.sh does not
-- see it; its isolation is asserted here instead.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000c1', 'carlotta@test.local'),
       ('00000000-0000-0000-0000-0000000000c2', 'blank@test.local');
update public.profiles set display_name = '  Carlotta Example '
  where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = '   '
  where id = '00000000-0000-0000-0000-0000000000c2';

select ok(
  has_function_privilege('anon', 'public.login_greeting_name(text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.login_greeting_name(text, text)', 'EXECUTE'),
  'only anon can execute login_greeting_name'
);

set local role anon;
set local request.jwt.claims to '{}';

select throws_ok(
  $$ select * from private.login_greeting_attempts $$,
  '42501',
  null,
  'anon cannot select private.login_greeting_attempts'
);
select throws_ok(
  $$ insert into private.login_greeting_attempts (key) values ('x') $$,
  '42501',
  null,
  'anon cannot insert into private.login_greeting_attempts'
);

select is(
  public.login_greeting_name(' Carlotta@Test.Local ', 'ip-a'),
  'Carlotta',
  'returns the first name of the seeded user (trimmed, case-insensitive email)'
);
select is(
  public.login_greeting_name('nobody@test.local', 'ip-b'),
  null,
  'an unknown email returns null'
);
select is(
  public.login_greeting_name('blank@test.local', 'ip-c'),
  null,
  'a blank display_name returns null'
);

-- Email limit: 5 per window. Calls 1-5 pass (the 1st above used another
-- address), the 6th for the same address is refused even for a fresh client.
select is(
  (select count(*)::int from (
     select public.login_greeting_name('carlotta@test.local', 'ip-d' || g) as n
     from generate_series(1, 4) g) s
   where n = 'Carlotta'),
  4,
  'calls 2-5 for the same email still return the name'
);
select is(
  public.login_greeting_name('carlotta@test.local', 'ip-e'),
  null,
  'the 6th call for the same email within the window returns null'
);

-- IP limit: 10 per window, across different emails.
select is(
  (select count(*)::int from (
     select public.login_greeting_name('user' || g || '@test.local', 'ip-f') as n
     from generate_series(1, 10) g) s),
  10,
  'ten calls for one client key run'
);
select is(
  public.login_greeting_name('carlotta2@test.local', 'ip-f'),
  null,
  'the 11th call for the same client key returns null'
);

select * from finish();
rollback;
