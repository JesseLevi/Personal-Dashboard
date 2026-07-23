-- Two-user isolation test for boards (ADR-0009 pattern, copied from
-- rls-profiles.sql). Both users get an auto-seeded "Te doen" board the
-- moment they're inserted into auth.users (seed_default_board trigger).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Seed two users directly in auth.users (seed_default_board trigger creates
-- each a default board + 4 columns).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000001b', 'b@test.local');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000001a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.boards $$,
  $$ values (1) $$,
  'A sees exactly one board (their own auto-seeded default board)'
);
select results_eq(
  $$ select user_id from public.boards $$,
  $$ values ('00000000-0000-0000-0000-00000000001a'::uuid) $$,
  'the visible board belongs to A'
);
select is_empty(
  $$ update public.boards set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000001b' returning id $$,
  'A cannot update B''s board'
);
select is_empty(
  $$ delete from public.boards
     where user_id = '00000000-0000-0000-0000-00000000001b' returning id $$,
  'A cannot delete B''s board'
);
select throws_ok(
  $$ insert into public.boards (user_id, name, position, is_favorite)
     values ('00000000-0000-0000-0000-00000000001b', 'sneaky board', 5000, false) $$,
  '42501',
  null,
  'A cannot insert a board for B'
);
select throws_ok(
  $$ insert into public.boards (user_id, name, position, is_favorite)
     values ('00000000-0000-0000-0000-00000000001a', 'second favorite', 5000, true) $$,
  '23505',
  null,
  'A cannot have a second favorite board (boards_one_favorite_per_user)'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.boards $$,
  'anon sees no boards'
);

select * from finish();
rollback;
