-- Two-user isolation test for embeddings and set_ai_enabled
-- (#577, ADR-0043 / ADR-0009), plus the column-grant lock on the opt-in.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-577000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-577000000b01', 'b@test.local');

insert into public.notes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-577000000a11', '00000000-0000-0000-0000-577000000a01',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-577000000a01' limit 1),
        'A note', 1000),
       ('00000000-0000-0000-0000-577000000b11', '00000000-0000-0000-0000-577000000b01',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-577000000b01' limit 1),
        'B note', 1000);
insert into public.cards (id, user_id, column_id, title, position)
values ('00000000-0000-0000-0000-577000000a21', '00000000-0000-0000-0000-577000000a01',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-577000000a01' limit 1),
        'A card', 1000);

select set_config('test.v1', '[1' || repeat(',0', 1023) || ']', true);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000a01", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000a01', '00000000-0000-0000-0000-577000000a11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '42501', null, 'A cannot write embeddings before opting in'
);
select lives_ok(
  $$ select public.set_ai_enabled(true) $$,
  'A opts in through set_ai_enabled'
);
select results_eq(
  $$ select ai_enabled, ai_enabled_at is not null from public.profiles
     where id = '00000000-0000-0000-0000-577000000a01' $$,
  $$ values (true, true) $$,
  'the flag and its timestamp are set'
);
select lives_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000a01', '00000000-0000-0000-0000-577000000a11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  'A writes an embedding for their own note after opting in'
);
select throws_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000a01', '00000000-0000-0000-0000-577000000a11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '23505', null, 'a source has one row per chunk_index'
);
select throws_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000a01', '00000000-0000-0000-0000-577000000b11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '42501', null, 'A cannot attach an embedding to B''s note'
);
select throws_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000b01', '00000000-0000-0000-0000-577000000a11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '42501', null, 'A cannot write an embedding as B'
);
select throws_ok(
  $$ update public.profiles set ai_enabled = false
     where id = '00000000-0000-0000-0000-577000000a01' $$,
  '42501', null, 'the opt-in column is not writable directly'
);
select lives_ok(
  $$ update public.profiles set display_name = 'A'
     where id = '00000000-0000-0000-0000-577000000a01' $$,
  'ordinary profile columns stay writable'
);

-- Act as B.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000b01", "role": "authenticated"}';

select is(
  (select count(*)::int from public.embeddings), 0,
  'B sees none of A''s embeddings'
);
select lives_ok($$ select public.set_ai_enabled(true) $$, 'B opts in');
select lives_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000b01', '00000000-0000-0000-0000-577000000b11',
             'y', 'h2', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  'B writes an embedding for their own note'
);
select is_empty(
  $$ update public.embeddings set content_text = 'hacked'
     where note_id = '00000000-0000-0000-0000-577000000a11' returning id $$,
  'B cannot update A''s embedding'
);
select is_empty(
  $$ delete from public.embeddings
     where note_id = '00000000-0000-0000-0000-577000000a11' returning id $$,
  'B cannot delete A''s embedding'
);
select is(
  (select count(*)::int from public.embeddings), 1,
  'B sees exactly their own embedding'
);

-- Opting out wipes only the caller's rows.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000a01", "role": "authenticated"}';
select lives_ok($$ select public.set_ai_enabled(false) $$, 'A opts out');
select results_eq(
  $$ select ai_enabled, ai_enabled_at is null from public.profiles
     where id = '00000000-0000-0000-0000-577000000a01' $$,
  $$ values (false, true) $$,
  'switching off clears the flag and the timestamp'
);
select is(
  (select count(*)::int from public.embeddings), 0,
  'switching off deleted A''s embeddings'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000b01", "role": "authenticated"}';
select is(
  (select count(*)::int from public.embeddings), 1,
  'switching off left B''s embeddings alone'
);

-- Deleting a source cascades to its embeddings.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000a01", "role": "authenticated"}';
select lives_ok($$ select public.set_ai_enabled(true) $$, 'A opts in again');
select lives_ok(
  $$ insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000a01', '00000000-0000-0000-0000-577000000a11',
             'x', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  'A writes an embedding again'
);
select lives_ok(
  $$ delete from public.notes where id = '00000000-0000-0000-0000-577000000a11' $$,
  'A deletes the note'
);
select is(
  (select count(*)::int from public.embeddings), 0,
  'the embedding went with its note'
);

-- Anonymous gets nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty($$ select id from public.embeddings $$, 'anon sees no embeddings');
select throws_ok(
  $$ select public.set_ai_enabled(true) $$,
  '42501', null, 'anon cannot call set_ai_enabled'
);

-- Table-owner checks: the arc needs exactly one source.
reset role;
select throws_ok(
  $$ insert into public.embeddings (user_id, note_id, card_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000b01', '00000000-0000-0000-0000-577000000b11',
             '00000000-0000-0000-0000-577000000a21',
             'x', 'h3', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '23514', null, 'two sources on one row are refused'
);
select throws_ok(
  $$ insert into public.embeddings (user_id, content_text, content_hash, source_updated_at, model, embedding)
     values ('00000000-0000-0000-0000-577000000b01',
             'x', 'h3', now(), 'm', current_setting('test.v1')::extensions.halfvec) $$,
  '23514', null, 'a row without a source is refused'
);

select * from finish();
rollback;
