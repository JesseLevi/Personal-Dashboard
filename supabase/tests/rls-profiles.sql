-- Two-user isolation test for profiles (ADR-0009 pattern — copy this file as
-- rls-<table>.sql for every new table; check-rls-coverage.sh enforces that).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Seed two users directly in auth.users (signup trigger creates profiles).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.profiles $$,
  $$ values (1) $$,
  'A sees exactly one profile (their own)'
);
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'the visible profile is A''s own'
);
select is_empty(
  $$ update public.profiles set display_name = 'hacked'
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s profile'
);
select is_empty(
  $$ delete from public.profiles
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot delete B''s profile'
);
select throws_ok(
  $$ insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501',
  null,
  'A cannot insert a profile for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.profiles $$,
  'anon sees no profiles'
);

select * from finish();
rollback;
