-- Version check on note saves (ADR-0056, 20261102000002_note_content_version.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-48000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-48000000001b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-48000000001b", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
values ('00000000-0000-0000-0000-48000000001b',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-48000000001b' limit 1),
  'B note', 1000);
select set_config('app.b_note', (select id::text from public.notes limit 1), true);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-48000000001a", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
values ('00000000-0000-0000-0000-48000000001a',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-48000000001a' limit 1),
  'A note', 1000);
select set_config('app.a_note', (select id::text from public.notes where title = 'A note'), true);

select is(
  (select content_version from public.notes where id = current_setting('app.a_note')::uuid),
  0,
  'a new note starts at version 0'
);

select is(
  public.save_note_content_versioned(
    current_setting('app.a_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'Tab A', 'a', null, 0),
  1,
  'a save with the current version succeeds and returns the next version'
);
select is(
  (select content_version from public.notes where id = current_setting('app.a_note')::uuid),
  1,
  'the stored version is bumped'
);

select throws_ok(
  $$ select public.save_note_content_versioned(
       current_setting('app.a_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'Tab B', 'b', null, 0) $$,
  'NL409', null,
  'a save with a stale version fails with NL409'
);
select is(
  (select title from public.notes where id = current_setting('app.a_note')::uuid),
  'Tab A',
  'the stale save changed nothing'
);
select is(
  (select content_version from public.notes where id = current_setting('app.a_note')::uuid),
  1,
  'the stale save did not bump the version'
);

select public.save_note_content(
  current_setting('app.a_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'Legacy', 'l', null);
select is(
  (select content_version from public.notes where id = current_setting('app.a_note')::uuid),
  2,
  'the unversioned save also bumps the version'
);
select throws_ok(
  $$ select public.save_note_content_versioned(
       current_setting('app.a_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'Stale', 's', null, 1) $$,
  'NL409', null,
  'a client that missed the unversioned save gets NL409'
);

select public.move_note(
  current_setting('app.a_note')::uuid,
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-48000000001a' order by position desc limit 1),
  0);
select is(
  (select content_version from public.notes where id = current_setting('app.a_note')::uuid),
  2,
  'moving a note does not bump the version'
);

select throws_ok(
  $$ select public.save_note_content_versioned(
       current_setting('app.b_note')::uuid, '{"type":"doc","content":[]}'::jsonb, 'hacked', 'x', null,
       0) $$,
  'NL404', null,
  'A cannot save B''s note, even with B''s current version'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-48000000001b", "role": "authenticated"}';
select is(
  (select title from public.notes where id = current_setting('app.b_note')::uuid),
  'B note',
  'B''s note is untouched'
);

select * from finish();
rollback;
