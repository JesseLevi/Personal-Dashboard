-- Test for public.toggle_board_favorite (#286,
-- 20260817000001_toggle_board_favorite_rpc.sql), ADR-0009 pattern extended to
-- RPCs like rls-move-rpcs.sql. Covers on, off, switching between two boards
-- (never 0 or 2 favorites), cross-user rejection and anon.
--
-- seed_default_board gives each user a default board that is the favorite.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-20000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-20000000001b', 'b@test.local');

set local role authenticated;

-- B's board id, stashed while acting as B (see rls-move-rpcs.sql for why).
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-20000000001b", "role": "authenticated"}';
select set_config(
  'app.b_board_id',
  (select id::text from public.boards where user_id = '00000000-0000-0000-0000-20000000001b' limit 1),
  true
);

-- Act as A; give A a second (non-favorite) board.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-20000000001a", "role": "authenticated"}';
insert into public.boards (user_id, name, position)
values ('00000000-0000-0000-0000-20000000001a', 'A''s second board', 2000);

select set_config(
  'app.a_board1',
  (select id::text from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and is_favorite),
  true
);
select set_config(
  'app.a_board2',
  (select id::text from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and name = 'A''s second board'),
  true
);

-- Off: board 1 is the seeded favorite.
select is(
  public.toggle_board_favorite(current_setting('app.a_board1')::uuid),
  false,
  'toggling the favorite board off returns false'
);
select is(
  (select count(*)::int from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and is_favorite),
  0,
  'after toggling off, A has zero favorites'
);

-- On: board 2.
select is(
  public.toggle_board_favorite(current_setting('app.a_board2')::uuid),
  true,
  'toggling a non-favorite board on returns true'
);
select is(
  (select id::text from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and is_favorite),
  current_setting('app.a_board2'),
  'after toggling on, board 2 is the single favorite'
);

-- Switch: board 1 on clears board 2 in the same call.
select is(
  public.toggle_board_favorite(current_setting('app.a_board1')::uuid),
  true,
  'switching the favorite to board 1 returns true'
);
select is(
  (select count(*)::int from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and is_favorite),
  1,
  'after switching, A has exactly one favorite'
);
select is(
  (select id::text from public.boards
   where user_id = '00000000-0000-0000-0000-20000000001a' and is_favorite),
  current_setting('app.a_board1'),
  'after switching, the favorite is board 1 and board 2 is cleared'
);

-- Cross-user: A cannot toggle B's board, and B's favorite is untouched.
select throws_ok(
  $$ select public.toggle_board_favorite(current_setting('app.b_board_id')::uuid) $$,
  'MV404',
  null,
  'A cannot toggle a foreign (B''s) board'
);
select throws_ok(
  $$ select public.toggle_board_favorite('00000000-0000-0000-0000-2000000000ff') $$,
  'MV404',
  null,
  'toggling a nonexistent board raises MV404'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-20000000001b", "role": "authenticated"}';
select is(
  (select is_favorite from public.boards where id = current_setting('app.b_board_id')::uuid),
  true,
  'B''s favorite is unchanged by A''s rejected attempt'
);

-- Anonymous has no EXECUTE grant.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.toggle_board_favorite(current_setting('app.b_board_id')::uuid) $$,
  '42501',
  null,
  'anon cannot execute toggle_board_favorite'
);

select * from finish();
rollback;
