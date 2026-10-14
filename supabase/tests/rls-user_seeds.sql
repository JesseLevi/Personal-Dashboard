-- Test for public.user_seeds + public.ensure_user_defaults() (#293, ADR-0017,
-- 20261007000001_ensure_user_defaults.sql): ADR-0009 two-user isolation for
-- the marker table, plus the lazy-seed behaviour and function privileges.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Triggers seed + mark all users on insert (new-account path).
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-3000000000aa', 'a@test.local'),
       ('00000000-0000-0000-0000-3000000000ab', 'b@test.local'),
       ('00000000-0000-0000-0000-3000000000ac', 'c@test.local');

select is(
  (select count(*)::int from public.user_seeds
   where user_id = '00000000-0000-0000-0000-3000000000aa'),
  5,
  'the signup triggers mark all five seeds for a new user'
);
select is(
  (select count(*)::int from public.boards
   where user_id = '00000000-0000-0000-0000-3000000000aa'),
  1,
  'a new user has exactly one seeded board (trigger + marker, no double seed)'
);

-- Simulate pre-trigger ("existing") accounts: A has nothing at all, C has a
-- customised single recipe category and no board/note categories.
delete from public.user_seeds
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
delete from public.boards
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
delete from public.recipe_categories
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
delete from public.note_categories
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
delete from public.shopping_lists
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
delete from public.calendars
  where user_id in ('00000000-0000-0000-0000-3000000000aa', '00000000-0000-0000-0000-3000000000ac');
insert into public.recipe_categories (user_id, name, icon, position)
  values ('00000000-0000-0000-0000-3000000000ac', 'Mijn eigen', 'Croissant', 1000);

-- Act as existing account A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-3000000000aa", "role": "authenticated"}';

select is_empty($$ select 1 from public.user_seeds $$, 'precondition: A has no markers');

select lives_ok($$ select public.ensure_user_defaults() $$, 'A can call ensure_user_defaults');

select is((select count(*)::int from public.boards), 1, 'A got exactly one board');
select is((select count(*)::int from public.board_columns), 4, 'A got the four default columns');
select is((select count(*)::int from public.recipe_categories), 3, 'A got three recipe categories');
select is((select count(*)::int from public.note_categories), 3, 'A got three note categories');
select is((select count(*)::int from public.shopping_lists), 1, 'A got a default shopping list');
select is((select count(*)::int from public.calendars), 1, 'A got a default calendar');
select is((select count(*)::int from public.user_seeds), 5, 'A has five markers');

-- Second call adds nothing.
select lives_ok($$ select public.ensure_user_defaults() $$, 'second call succeeds');
select is(
  ((select count(*) from public.boards) + (select count(*) from public.board_columns)
   + (select count(*) from public.recipe_categories) + (select count(*) from public.note_categories)
   + (select count(*) from public.shopping_lists) + (select count(*) from public.calendars)
   + (select count(*) from public.user_seeds))::int,
  1 + 4 + 3 + 3 + 1 + 1 + 5,
  'a repeated call adds no rows (no duplicates)'
);

-- Deleting seeded rows does not resurrect them (marker, not zero-rows check).
delete from public.note_categories;
select public.ensure_user_defaults();
select is((select count(*)::int from public.note_categories), 0,
  'a seed the user deleted is not re-applied once marked');

-- Existing account C with a customised category: gets the missing seeds, but
-- its existing recipe category is not topped up with defaults.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-3000000000ac", "role": "authenticated"}';
select public.ensure_user_defaults();
select is(
  (select array_agg(name) from public.recipe_categories),
  array['Mijn eigen'],
  'a legacy account that already has recipe categories is marked, not reseeded'
);
select is((select count(*)::int from public.boards), 1, 'C still got a board');

-- Isolation: C does not see A's markers; no client writes.
select is(
  (select count(*)::int from public.user_seeds
   where user_id = '00000000-0000-0000-0000-3000000000aa'),
  0,
  'C cannot see A''s markers'
);
select throws_ok(
  $$ insert into public.user_seeds (user_id, seed_key)
     values ('00000000-0000-0000-0000-3000000000ac', 'forged') $$,
  '42501',
  null,
  'a client cannot write markers (no insert grant)'
);

-- Helpers taking a user id are not callable by clients.
select throws_ok(
  $$ select public.apply_seed('00000000-0000-0000-0000-3000000000ab', 'default_board') $$,
  '42501',
  null,
  'authenticated cannot call apply_seed'
);
select throws_ok(
  $$ select public.seed_board_for('00000000-0000-0000-0000-3000000000ab') $$,
  '42501',
  null,
  'authenticated cannot call a seed body for another user'
);

-- Anonymous: no table access, no EXECUTE.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.ensure_user_defaults() $$,
  '42501',
  null,
  'anon cannot execute ensure_user_defaults'
);
select throws_ok(
  $$ select 1 from public.user_seeds $$,
  '42501',
  null,
  'anon has no access to user_seeds'
);

select * from finish();
rollback;
