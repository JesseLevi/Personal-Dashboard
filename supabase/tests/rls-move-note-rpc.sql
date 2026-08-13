-- Ownership-guard test for public.move_note (#228,
-- 20260813000002_move_note_rpc.sql), ADR-0009 pattern extended to this RPC
-- the same way supabase/tests/rls-move-rpcs.sql already extends it to
-- move_card/move_recipe. move_note isn't itself a table (nothing here is
-- required by scripts/check-rls-coverage.sh's per-table gate), but every
-- guard the migration raises -- a foreign note, a foreign category, and no
-- EXECUTE grant for anon -- is exercised explicitly below, matching
-- rls-move-rpcs.sql's own precedent (kept as a standalone file per table/RPC
-- pairing, since move_note has no move_card-style column-mismatch case to
-- add a second function's worth of assertions here).
--
-- Both users get a default note_categories seed the moment they're inserted
-- into auth.users (seed_default_note_categories trigger,
-- 20260813000001_note_schema.sql: 'Overig'/'Werk'/'Sport').
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-10000000002a', 'a@test.local'),
       ('00000000-0000-0000-0000-10000000002b', 'b@test.local');

set local role authenticated;

-- --- Seed A's fixtures: a note in A's own auto-seeded default category. ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000002a", "role": "authenticated"}';

insert into public.notes (user_id, category_id, title, position)
values (
  '00000000-0000-0000-0000-10000000002a',
  (select id from public.note_categories
   where user_id = '00000000-0000-0000-0000-10000000002a' order by position limit 1),
  'A''s note', 1000
);

-- --- Seed B's fixtures: a note in B's own auto-seeded default category.
-- Stash their real ids in session GUCs while still acting as B -- a plain
-- subquery for B's row under A's own RLS would already come back NULL before
-- ever reaching the function, which would only prove RLS blocks the lookup,
-- not that move_note's own explicit ownership guard fires for a real,
-- resolvable id belonging to someone else (same reasoning as
-- rls-move-rpcs.sql's app.b_recipe_id / rls-recipe_step_ingredients.sql's
-- app.b_recipe_id). ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000002b", "role": "authenticated"}';

insert into public.notes (user_id, category_id, title, position)
values (
  '00000000-0000-0000-0000-10000000002b',
  (select id from public.note_categories
   where user_id = '00000000-0000-0000-0000-10000000002b' order by position limit 1),
  'B''s note', 1000
);

select set_config(
  'app.b_note_id',
  (select id::text from public.notes where user_id = '00000000-0000-0000-0000-10000000002b' limit 1),
  true
);
select set_config(
  'app.b_category_id',
  (select id::text from public.note_categories
   where user_id = '00000000-0000-0000-0000-10000000002b' order by position limit 1),
  true
);

-- Act as user A for every RPC assertion below.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-10000000002a", "role": "authenticated"}';

select throws_ok(
  $$ select public.move_note(
       current_setting('app.b_note_id')::uuid,
       (select id from public.note_categories
        where user_id = '00000000-0000-0000-0000-10000000002a' order by position limit 1),
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_note a foreign (B''s) note'
);
select throws_ok(
  $$ select public.move_note(
       (select id from public.notes where user_id = '00000000-0000-0000-0000-10000000002a' limit 1),
       current_setting('app.b_category_id')::uuid,
       0
     ) $$,
  'MV404',
  null,
  'A cannot move_note into a foreign (B''s) category'
);

-- Sanity check: a legitimate move by the owning user succeeds and returns a
-- numeric position -- proves the two rejection tests above are rejecting the
-- specific bad input, not failing for an unrelated reason.
select isnt(
  (select public.move_note(
     (select id from public.notes where user_id = '00000000-0000-0000-0000-10000000002a' limit 1),
     (select id from public.note_categories
      where user_id = '00000000-0000-0000-0000-10000000002a' order by position limit 1),
     0
   )),
  null,
  'A can move_note A''s own note within A''s own category'
);

-- Anonymous cannot execute the RPC at all -- no EXECUTE grant
-- (20260813000002_move_note_rpc.sql revokes from public, grants only to
-- authenticated/service_role), same "anon gets nothing" ADR-0009 rule
-- extended to a function instead of a table.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.move_note(
       current_setting('app.b_note_id')::uuid,
       current_setting('app.b_category_id')::uuid,
       0
     ) $$,
  '42501',
  null,
  'anon cannot execute move_note'
);

select * from finish();
rollback;
