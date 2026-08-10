-- Ownership-guard test for public.move_card / public.move_recipe (#169,
-- 20260810000002_move_rpcs.sql), ADR-0009 pattern extended to RPCs the same
-- way rls-recipe_step_ingredients.sql already extends it to
-- replace_recipe_contents. These two functions aren't themselves a table
-- (nothing here is required by scripts/check-rls-coverage.sh's per-table
-- gate), but every guard the ticket calls out for them -- a foreign card, a
-- foreign column, and a column that IS the caller's own but sits on a
-- different board -- is exercised explicitly below, since that's precisely
-- the security surface the four-query chain used to cover and the RPC now
-- has to replicate.
--
-- Both users get an auto-seeded default board + 4 columns
-- (seed_default_board trigger, 20260723000001_kanban_schema.sql) and a
-- default recipe_categories row (seed_default_recipe_categories trigger,
-- 20260730000002_recipe_schema.sql) the moment they're inserted into
-- auth.users.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-10000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-10000000001b', 'b@test.local');

set local role authenticated;

-- --- Seed A's fixtures: a card on A's auto-seeded board, plus a second
-- board (with its own column) A also owns -- needed for the "own column,
-- wrong board" MV409 case below. ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000001a", "role": "authenticated"}';

insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-10000000001a',
  (select id from public.board_columns
   where user_id = '00000000-0000-0000-0000-10000000001a' order by position limit 1),
  'A''s card', 1000
);

insert into public.boards (user_id, name, position)
values ('00000000-0000-0000-0000-10000000001a', 'A''s second board', 2000);

insert into public.board_columns (user_id, board_id, name, icon, position)
values (
  '00000000-0000-0000-0000-10000000001a',
  (select id from public.boards
   where user_id = '00000000-0000-0000-0000-10000000001a' and name = 'A''s second board'),
  'A''s other-board column', 'Circle', 1000
);

-- --- Seed B's fixtures: a card on B's auto-seeded board, a recipe in B's
-- auto-seeded category. Stash their real ids (plus a real column/category id
-- of B's) in session GUCs while still acting as B -- a plain subquery for
-- B's row under A's own RLS would already come back NULL before ever
-- reaching the function, which would only prove RLS blocks the lookup, not
-- that move_card/move_recipe's own explicit ownership guard fires for a
-- real, resolvable id belonging to someone else (same reasoning as
-- rls-recipe_step_ingredients.sql's app.b_recipe_id). ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000001b", "role": "authenticated"}';

insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-10000000001b',
  (select id from public.board_columns
   where user_id = '00000000-0000-0000-0000-10000000001b' order by position limit 1),
  'B''s card', 1000
);

insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-10000000001b',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-10000000001b' limit 1),
  'B''s recipe', 2, 1000
);

select set_config(
  'app.b_card_id',
  (select id::text from public.cards where user_id = '00000000-0000-0000-0000-10000000001b' limit 1),
  true
);
select set_config(
  'app.b_column_id',
  (select id::text from public.board_columns
   where user_id = '00000000-0000-0000-0000-10000000001b' order by position limit 1),
  true
);
select set_config(
  'app.b_recipe_id',
  (select id::text from public.recipes where user_id = '00000000-0000-0000-0000-10000000001b' limit 1),
  true
);
select set_config(
  'app.b_category_id',
  (select id::text from public.recipe_categories where user_id = '00000000-0000-0000-0000-10000000001b' limit 1),
  true
);

-- Act as user A for every RPC assertion below.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000001a", "role": "authenticated"}';

select throws_ok(
  $$ select public.move_card(
       current_setting('app.b_card_id')::uuid,
       (select id from public.board_columns
        where user_id = '00000000-0000-0000-0000-10000000001a' order by position limit 1),
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_card a foreign (B''s) card'
);
select throws_ok(
  $$ select public.move_card(
       (select id from public.cards where user_id = '00000000-0000-0000-0000-10000000001a' limit 1),
       current_setting('app.b_column_id')::uuid,
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_card into a foreign (B''s) column'
);
select throws_ok(
  $$ select public.move_card(
       (select id from public.cards where user_id = '00000000-0000-0000-0000-10000000001a' limit 1),
       (select id from public.board_columns
        where user_id = '00000000-0000-0000-0000-10000000001a' and name = 'A''s other-board column'),
       0
     ) $$,
  'MV409',
  null,
  'A cannot move_card into A''s own column when it is on a different board than the card'
);
select throws_ok(
  $$ select public.move_recipe(
       current_setting('app.b_recipe_id')::uuid,
       (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-10000000001a' limit 1),
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_recipe a foreign (B''s) recipe'
);
select throws_ok(
  $$ select public.move_recipe(
       (select id from public.recipes where user_id = '00000000-0000-0000-0000-10000000001a' limit 1),
       current_setting('app.b_category_id')::uuid,
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_recipe into a foreign (B''s) category'
);

-- Sanity check: a legitimate same-board move by the owning user succeeds and
-- returns a numeric position -- proves the two rejection tests above are
-- rejecting the specific bad input, not failing for an unrelated reason.
select isnt(
  (select public.move_card(
     (select id from public.cards where user_id = '00000000-0000-0000-0000-10000000001a' limit 1),
     (select id from public.board_columns
      where user_id = '00000000-0000-0000-0000-10000000001a' order by position limit 1),
     0
   )),
  null,
  'A can move_card A''s own card within A''s own board'
);

-- Anonymous cannot execute either RPC at all -- no EXECUTE grant
-- (20260810000002_move_rpcs.sql revokes from public, grants only to
-- authenticated/service_role), same "anon gets nothing" ADR-0009 rule
-- extended to a function instead of a table.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.move_card(
       current_setting('app.b_card_id')::uuid,
       current_setting('app.b_column_id')::uuid,
       0
     ) $$,
  '42501',
  null,
  'anon cannot execute move_card'
);
select throws_ok(
  $$ select public.move_recipe(
       current_setting('app.b_recipe_id')::uuid,
       current_setting('app.b_category_id')::uuid,
       0
     ) $$,
  '42501',
  null,
  'anon cannot execute move_recipe'
);

select * from finish();
rollback;
