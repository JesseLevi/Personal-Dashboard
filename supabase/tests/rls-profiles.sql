-- Two-user isolation test for profiles (ADR-0009 pattern — copy this file as
-- rls-<table>.sql for every new table; check-rls-coverage.sh enforces that).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

-- #162: profiles.locale update -- own row succeeds, other user's row is a
-- no-op (RLS's update-using clause filters it out before the check
-- constraint is even reached, same is_empty pattern as the display_name
-- case above).
select results_eq(
  $$ update public.profiles set locale = 'en'
     where id = '00000000-0000-0000-0000-00000000000a' returning locale $$,
  $$ values ('en'::text) $$,
  'A can update their own locale'
);
select is_empty(
  $$ update public.profiles set locale = 'en'
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s locale'
);
-- #404: profiles.last_name -- own row succeeds, other user's row is a no-op.
select results_eq(
  $$ update public.profiles set last_name = 'Kamps'
     where id = '00000000-0000-0000-0000-00000000000a' returning last_name $$,
  $$ values ('Kamps'::text) $$,
  'A can update their own last_name'
);
select is_empty(
  $$ update public.profiles set last_name = 'hacked'
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s last_name'
);
-- #434: profiles.avatar_path -- own row succeeds, other user's row is a no-op;
-- avatar_path_for hands the owner their own key and nobody else's.
select results_eq(
  $$ update public.profiles set avatar_path = '00000000-0000-0000-0000-00000000000a/avatar/x.webp'
     where id = '00000000-0000-0000-0000-00000000000a' returning avatar_path $$,
  $$ values ('00000000-0000-0000-0000-00000000000a/avatar/x.webp'::text) $$,
  'A can update their own avatar_path'
);
select is_empty(
  $$ update public.profiles set avatar_path = 'hacked'
     where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'A cannot update B''s avatar_path'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-00000000000a'),
  '00000000-0000-0000-0000-00000000000a/avatar/x.webp',
  'avatar_path_for returns the caller''s own key'
);
select is(
  public.avatar_path_for('00000000-0000-0000-0000-00000000000b'),
  null,
  'avatar_path_for returns null for an unrelated user'
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
