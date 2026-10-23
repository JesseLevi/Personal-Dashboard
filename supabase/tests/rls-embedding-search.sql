-- search_text and search_semantic: results, filters and isolation between
-- users (#577, ADR-0043 §10).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-577000000f01', 'f@test.local'),
       ('00000000-0000-0000-0000-577000000f02', 'h@test.local');

select set_config('test.v1', '[1' || repeat(',0', 1023) || ']', true);
select set_config('test.v2', '[0,1' || repeat(',0', 1022) || ']', true);

insert into public.notes (id, user_id, category_id, title, content_text, position)
select v.id::uuid, v.uid::uuid,
       (select id from public.note_categories where user_id = v.uid::uuid limit 1),
       v.title, v.body, 1000
from (values
  ('00000000-0000-0000-0000-577000000f11', '00000000-0000-0000-0000-577000000f01', 'Pindakaas notitie', 'lekker op brood'),
  ('00000000-0000-0000-0000-577000000f16', '00000000-0000-0000-0000-577000000f01', 'Korting 100% nu', 'aanbieding'),
  ('00000000-0000-0000-0000-577000000f17', '00000000-0000-0000-0000-577000000f01', 'Korting 1000 nu', 'aanbieding'),
  ('00000000-0000-0000-0000-577000000f21', '00000000-0000-0000-0000-577000000f02', 'Pindakaas van H', 'geheim')
) as v(id, uid, title, body);

insert into public.recipes (id, user_id, category_id, title, servings, position)
values ('00000000-0000-0000-0000-577000000f12', '00000000-0000-0000-0000-577000000f01',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-577000000f01' limit 1),
        'Pindakaas koekjes', 2, 1000);
insert into public.cards (id, user_id, column_id, title, description, position)
values ('00000000-0000-0000-0000-577000000f13', '00000000-0000-0000-0000-577000000f01',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-577000000f01' limit 1),
        'Boodschappen doen', 'pindakaas kopen', 1000);
insert into public.shopping_list_items (id, user_id, name, position)
values ('00000000-0000-0000-0000-577000000f14', '00000000-0000-0000-0000-577000000f01', 'pindakaas', 1000);
insert into public.calendar_events (id, user_id, calendar_id, title, location, starts_at, ends_at)
values ('00000000-0000-0000-0000-577000000f15', '00000000-0000-0000-0000-577000000f01',
        (select id from public.calendars where user_id = '00000000-0000-0000-0000-577000000f01' and is_default),
        'Lunch', 'Pindakaasstraat 1', now(), now() + interval '1 hour');

-- Semantic fixtures: the note has two chunks (best one must win).
insert into public.embeddings (user_id, note_id, chunk_index, content_text, content_hash, source_updated_at, model, embedding)
values ('00000000-0000-0000-0000-577000000f01', '00000000-0000-0000-0000-577000000f11', 0,
        'a', 'h1', now(), 'm', current_setting('test.v1')::extensions.halfvec),
       ('00000000-0000-0000-0000-577000000f01', '00000000-0000-0000-0000-577000000f11', 1,
        'b', 'h2', now(), 'm', current_setting('test.v2')::extensions.halfvec),
       ('00000000-0000-0000-0000-577000000f02', '00000000-0000-0000-0000-577000000f21', 0,
        'c', 'h3', now(), 'm', current_setting('test.v1')::extensions.halfvec);
insert into public.embeddings (user_id, recipe_id, chunk_index, content_text, content_hash, source_updated_at, model, embedding)
values ('00000000-0000-0000-0000-577000000f01', '00000000-0000-0000-0000-577000000f12', 0,
        'd', 'h4', now(), 'm', current_setting('test.v2')::extensions.halfvec);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000f01", "role": "authenticated"}';

select set_eq(
  $$ select source_type, source_id from public.search_text('pindakaas', null, 20) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000f11'::uuid),
            ('recipe', '00000000-0000-0000-0000-577000000f12'),
            ('card', '00000000-0000-0000-0000-577000000f13'),
            ('shopping_list_item', '00000000-0000-0000-0000-577000000f14'),
            ('calendar_event', '00000000-0000-0000-0000-577000000f15') $$,
  'search_text finds every module, and none of H''s rows'
);
select set_eq(
  $$ select source_type, source_id from public.search_text('pindakaas', array['recipe'], 20) $$,
  $$ values ('recipe'::text, '00000000-0000-0000-0000-577000000f12'::uuid) $$,
  'search_text honours the type filter'
);
select set_eq(
  $$ select source_type, source_id from public.search_text('100%', null, 10) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000f16'::uuid) $$,
  'LIKE wildcards in the query are literal'
);
select is_empty(
  $$ select * from public.search_text('a', null, 10) $$,
  'a one-character query returns nothing'
);
select is(
  (select count(*)::int from public.search_text('pindakaas', null, 20) where score between 0 and 1),
  5,
  'scores stay within 0..1'
);

select set_eq(
  $$ select source_type, source_id from public.search_semantic(
       current_setting('test.v1')::extensions.halfvec, null, 10) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000f11'::uuid),
            ('recipe', '00000000-0000-0000-0000-577000000f12') $$,
  'search_semantic returns the caller''s sources only, one row per source'
);
select is(
  (select source_id from public.search_semantic(current_setting('test.v1')::extensions.halfvec, null, 1)),
  '00000000-0000-0000-0000-577000000f11'::uuid,
  'the best chunk decides the rank'
);
select is(
  (select round(score::numeric, 3) from public.search_semantic(
     current_setting('test.v1')::extensions.halfvec, null, 10)
   where source_id = '00000000-0000-0000-0000-577000000f11'),
  1.000,
  'the note scores with its closest chunk'
);
select set_eq(
  $$ select source_type, source_id from public.search_semantic(
       current_setting('test.v1')::extensions.halfvec, array['recipe'], 10) $$,
  $$ values ('recipe'::text, '00000000-0000-0000-0000-577000000f12'::uuid) $$,
  'search_semantic honours the type filter'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000f02", "role": "authenticated"}';
select set_eq(
  $$ select source_type, source_id from public.search_semantic(
       current_setting('test.v1')::extensions.halfvec, null, 10) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000f21'::uuid) $$,
  'H sees only their own semantic hits'
);
select set_eq(
  $$ select source_type, source_id from public.search_text('pindakaas', null, 20) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000f21'::uuid) $$,
  'H sees only their own text hits'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select * from public.search_text('pindakaas', null, 10) $$,
  '42501', null, 'anon cannot search text'
);
select throws_ok(
  $$ select * from public.search_semantic(current_setting('test.v1')::extensions.halfvec, null, 10) $$,
  '42501', null, 'anon cannot search semantically'
);

select * from finish();
rollback;
