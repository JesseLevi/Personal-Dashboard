-- Two-user isolation + behaviour test for note_links and
-- public.save_note_content (#340, 20261010000002_note_links.sql, ADR-0023).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-30000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-30000000001b', 'b@test.local');

set local role authenticated;

-- B's note, id stashed while acting as B.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-30000000001b", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
values ('00000000-0000-0000-0000-30000000001b',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-30000000001b' limit 1),
  'B note', 1000);
select set_config('app.b_note', (select id::text from public.notes limit 1), true);

-- A's three notes.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-30000000001a", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
select '00000000-0000-0000-0000-30000000001a',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-30000000001a' limit 1),
  t, p
from (values ('n1', 1000), ('n2', 2000), ('n3', 3000)) as v (t, p);
select set_config('app.a1', (select id::text from public.notes where title = 'n1'), true);
select set_config('app.a2', (select id::text from public.notes where title = 'n2'), true);
select set_config('app.a3', (select id::text from public.notes where title = 'n3'), true);

-- --- save_note_content: add ---
select lives_ok(
  $$ select public.save_note_content(
       current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x',
       array[current_setting('app.a2')::uuid, current_setting('app.a3')::uuid]) $$,
  'A saves n1 linking n2 and n3'
);
select results_eq(
  $$ select target_note_id::text from public.note_links
     where source_note_id = current_setting('app.a1')::uuid order by 1 $$,
  $$ select x from (values (current_setting('app.a2')), (current_setting('app.a3'))) v (x) order by 1 $$,
  'link set equals the given targets'
);
select is(
  (select title from public.notes where id = current_setting('app.a1')::uuid),
  'T1',
  'title written in the same call'
);

-- --- replace: remove n3, keep n2, duplicates collapse ---
select lives_ok(
  $$ select public.save_note_content(
       current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x',
       array[current_setting('app.a2')::uuid, current_setting('app.a2')::uuid]) $$,
  'A re-saves n1 linking only n2 (duplicate id)'
);
select results_eq(
  $$ select target_note_id::text from public.note_links
     where source_note_id = current_setting('app.a1')::uuid $$,
  $$ select current_setting('app.a2') $$,
  'link set rewritten exactly (n3 removed, duplicate collapsed)'
);

-- --- dropped targets: foreign, unknown, self ---
select lives_ok(
  $$ select public.save_note_content(
       current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x',
       array[current_setting('app.b_note')::uuid, gen_random_uuid(), current_setting('app.a1')::uuid]) $$,
  'saving with foreign, unknown and self targets does not error'
);
select is_empty(
  $$ select 1 from public.note_links where source_note_id = current_setting('app.a1')::uuid $$,
  'foreign, unknown and self targets were dropped'
);

-- --- null target set clears links ---
select public.save_note_content(
  current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x',
  array[current_setting('app.a2')::uuid]);
select public.save_note_content(
  current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x', null);
select is_empty(
  $$ select 1 from public.note_links where source_note_id = current_setting('app.a1')::uuid $$,
  'null target set clears the links'
);

-- --- foreign source note ---
select throws_ok(
  $$ select public.save_note_content(
       current_setting('app.b_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'hacked', 'x',
       array[current_setting('app.a1')::uuid]) $$,
  'NL404', null,
  'A cannot save_note_content on B''s note'
);

-- --- direct inserts are RLS-guarded ---
select throws_ok(
  $$ insert into public.note_links (user_id, source_note_id, target_note_id)
     values ('00000000-0000-0000-0000-30000000001a',
       current_setting('app.a1')::uuid, current_setting('app.b_note')::uuid) $$,
  '42501', null,
  'A cannot insert a link targeting B''s note'
);
select throws_ok(
  $$ insert into public.note_links (user_id, source_note_id, target_note_id)
     values ('00000000-0000-0000-0000-30000000001a',
       current_setting('app.b_note')::uuid, current_setting('app.a1')::uuid) $$,
  '42501', null,
  'A cannot insert a link from B''s note'
);
select throws_ok(
  $$ insert into public.note_links (user_id, source_note_id, target_note_id)
     values ('00000000-0000-0000-0000-30000000001b',
       current_setting('app.a1')::uuid, current_setting('app.a2')::uuid) $$,
  '42501', null,
  'A cannot insert a link as B'
);

-- --- cascade both ways ---
select public.save_note_content(
  current_setting('app.a1')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T1', 'x',
  array[current_setting('app.a2')::uuid]);
select public.save_note_content(
  current_setting('app.a3')::uuid, '{"type":"doc","content":[]}'::jsonb, 'T3', 'x',
  array[current_setting('app.a1')::uuid]);
delete from public.notes where id = current_setting('app.a2')::uuid;
select is_empty(
  $$ select 1 from public.note_links where target_note_id = current_setting('app.a2')::uuid $$,
  'deleting a target removes links pointing at it'
);
delete from public.notes where id = current_setting('app.a1')::uuid;
select is_empty(
  $$ select 1 from public.note_links
     where source_note_id = current_setting('app.a1')::uuid
        or target_note_id = current_setting('app.a1')::uuid $$,
  'deleting a note removes its links both ways'
);

-- --- B sees nothing of A's links ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-30000000001b", "role": "authenticated"}';
select is_empty($$ select 1 from public.note_links $$, 'B sees no links');

-- --- anon ---
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.save_note_content(
       current_setting('app.b_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 't', 'x', null) $$,
  '42501', null,
  'anon cannot execute save_note_content'
);

select * from finish();
rollback;
