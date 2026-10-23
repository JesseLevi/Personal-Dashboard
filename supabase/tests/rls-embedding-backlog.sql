-- Backlog scan, drain throttle and the touch triggers that keep updated_at
-- in step with the canonical text (#577, ADR-0043 §4-5).
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-577000000c01', 'c@test.local'),
       ('00000000-0000-0000-0000-577000000d01', 'd@test.local'),
       ('00000000-0000-0000-0000-577000000e01', 'e@test.local');

select set_config('test.v1', '[1' || repeat(',0', 1023) || ']', true);

-- C owns one source of every type (plus a blank note); D and E one note each.
insert into public.notes (id, user_id, category_id, title, content_text, position)
select v.id::uuid, v.uid::uuid,
       (select id from public.note_categories where user_id = v.uid::uuid limit 1),
       v.title, v.body, 1000
from (values
  ('00000000-0000-0000-0000-577000000c11', '00000000-0000-0000-0000-577000000c01', 'C note', 'tekst'),
  ('00000000-0000-0000-0000-577000000c16', '00000000-0000-0000-0000-577000000c01', '', ''),
  ('00000000-0000-0000-0000-577000000d11', '00000000-0000-0000-0000-577000000d01', 'D note', 'tekst'),
  ('00000000-0000-0000-0000-577000000e11', '00000000-0000-0000-0000-577000000e01', 'E note', 'tekst')
) as v(id, uid, title, body);

insert into public.recipes (id, user_id, category_id, title, servings, position)
values ('00000000-0000-0000-0000-577000000c12', '00000000-0000-0000-0000-577000000c01',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-577000000c01' limit 1),
        'C recipe', 2, 1000);
insert into public.cards (id, user_id, column_id, title, position)
values ('00000000-0000-0000-0000-577000000c13', '00000000-0000-0000-0000-577000000c01',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-577000000c01' limit 1),
        'C card', 1000);
insert into public.shopping_list_items (id, user_id, name, position)
values ('00000000-0000-0000-0000-577000000c14', '00000000-0000-0000-0000-577000000c01', 'C melk', 1000);
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-577000000c15', '00000000-0000-0000-0000-577000000c01',
        (select id from public.calendars where user_id = '00000000-0000-0000-0000-577000000c01' and is_default),
        'C afspraak', now(), now() + interval '1 hour');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000c01", "role": "authenticated"}';
select public.set_ai_enabled(true);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000d01", "role": "authenticated"}';
select public.set_ai_enabled(true);
reset role;

-- Everything has rested; one event is the oldest. The updated_at triggers are off so the
-- backdated updated_at sticks.
alter table public.notes disable trigger user;
alter table public.recipes disable trigger user;
alter table public.cards disable trigger user;
alter table public.shopping_list_items disable trigger user;
alter table public.calendar_events disable trigger user;
update public.notes set updated_at = now() - interval '1 hour';
update public.recipes set updated_at = now() - interval '1 hour';
update public.cards set updated_at = now() - interval '1 hour';
update public.shopping_list_items set updated_at = now() - interval '1 hour';
update public.calendar_events set updated_at = now() - interval '1 hour';
update public.calendar_events set updated_at = now() - interval '3 hours'
  where id = '00000000-0000-0000-0000-577000000c15';
alter table public.notes enable trigger user;
alter table public.recipes enable trigger user;
alter table public.cards enable trigger user;
alter table public.shopping_list_items enable trigger user;
alter table public.calendar_events enable trigger user;

-- A note edited just now has not rested.
insert into public.notes (id, user_id, category_id, title, content_text, position)
values ('00000000-0000-0000-0000-577000000c17', '00000000-0000-0000-0000-577000000c01',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-577000000c01' limit 1),
        'Net bewerkt', 'tekst', 2000);

-- c11 is current, c12 is stale, c13 has another model, c14/c15 have none.
insert into public.embeddings (user_id, note_id, content_text, content_hash, source_updated_at, model, embedding)
values ('00000000-0000-0000-0000-577000000c01', '00000000-0000-0000-0000-577000000c11',
        'x', 'h1', now() - interval '1 hour', 'm1', current_setting('test.v1')::extensions.halfvec);
insert into public.embeddings (user_id, recipe_id, content_text, content_hash, source_updated_at, model, embedding)
values ('00000000-0000-0000-0000-577000000c01', '00000000-0000-0000-0000-577000000c12',
        'x', 'h2', now() - interval '2 hours', 'm1', current_setting('test.v1')::extensions.halfvec);
insert into public.embeddings (user_id, card_id, content_text, content_hash, source_updated_at, model, embedding)
values ('00000000-0000-0000-0000-577000000c01', '00000000-0000-0000-0000-577000000c13',
        'x', 'h3', now() - interval '1 hour', 'old', current_setting('test.v1')::extensions.halfvec);

-- ---------------------------------------------------------------------------
-- embedding_backlog
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000c01", "role": "authenticated"}';

select set_eq(
  $$ select source_type, source_id from public.embedding_backlog('m1', 50) $$,
  $$ values ('recipe'::text, '00000000-0000-0000-0000-577000000c12'::uuid),
            ('card', '00000000-0000-0000-0000-577000000c13'),
            ('shopping_list_item', '00000000-0000-0000-0000-577000000c14'),
            ('calendar_event', '00000000-0000-0000-0000-577000000c15') $$,
  'C: stale, other-model and missing sources; not current, blank or unrested ones'
);
select is(
  (select count(*)::int from public.embedding_backlog('m1', 2)), 2,
  'the limit applies'
);
select is(
  (select source_id from public.embedding_backlog('m1', 1)),
  '00000000-0000-0000-0000-577000000c15'::uuid,
  'oldest first'
);
select is(
  (select count(*)::int from public.embedding_backlog('m2', 50)
   where source_id = '00000000-0000-0000-0000-577000000c11'),
  1,
  'a different model puts a current source back on the backlog'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000d01", "role": "authenticated"}';
select set_eq(
  $$ select source_type, source_id from public.embedding_backlog('m1', 50) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000d11'::uuid) $$,
  'D sees only their own sources'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000e01", "role": "authenticated"}';
select is_empty(
  $$ select * from public.embedding_backlog('m1', 50) $$,
  'E has not opted in: empty backlog'
);
select throws_ok(
  $$ select * from public.embedding_backlog_for('00000000-0000-0000-0000-577000000c01', 'm1', 50) $$,
  '42501', null, 'authenticated cannot call embedding_backlog_for'
);

set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select set_eq(
  $$ select source_type, source_id from public.embedding_backlog_for(
       '00000000-0000-0000-0000-577000000c01', 'm1', 50) $$,
  $$ values ('recipe'::text, '00000000-0000-0000-0000-577000000c12'::uuid),
            ('card', '00000000-0000-0000-0000-577000000c13'),
            ('shopping_list_item', '00000000-0000-0000-0000-577000000c14'),
            ('calendar_event', '00000000-0000-0000-0000-577000000c15') $$,
  'service_role: the same scan for one member'
);
select set_eq(
  $$ select source_type, source_id from public.embedding_backlog_for(
       '00000000-0000-0000-0000-577000000d01', 'm1', 50) $$,
  $$ values ('note'::text, '00000000-0000-0000-0000-577000000d11'::uuid) $$,
  'service_role: scoped to the member asked for'
);
select is_empty(
  $$ select * from public.embedding_backlog_for(
       '00000000-0000-0000-0000-577000000e01', 'm1', 50) $$,
  'service_role: a member without opt-in has no backlog'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select * from public.embedding_backlog('m1', 50) $$,
  '42501', null, 'anon cannot read the backlog'
);
select throws_ok(
  $$ select public.claim_embedding_drain() $$,
  '42501', null, 'anon cannot claim a drain'
);

-- ---------------------------------------------------------------------------
-- claim_embedding_drain
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000c01", "role": "authenticated"}';
select is(public.claim_embedding_drain(), true, 'first claim succeeds');
select is(public.claim_embedding_drain(), false, 'a second claim within 10 minutes is refused');

reset role;
update private.embedding_drains set last_run_at = now() - interval '11 minutes';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000c01", "role": "authenticated"}';
select is(public.claim_embedding_drain(), true, 'a claim after 10 minutes succeeds again');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000d01", "role": "authenticated"}';
select is(public.claim_embedding_drain(), true, 'the throttle is per member');
select throws_ok(
  $$ select * from private.embedding_drains $$,
  '42501', null, 'clients cannot read the throttle table'
);

-- ---------------------------------------------------------------------------
-- Touch triggers: updated_at follows the canonical text
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-577000000c01", "role": "authenticated"}';
select public.replace_recipe_contents(
  '00000000-0000-0000-0000-577000000c12',
  '[{"name": "melk", "quantity": 1, "unit": "liter"}]'::jsonb,
  '[{"instruction": "Roer"}]'::jsonb
);
reset role;
select is(
  (select updated_at = now() from public.recipes where id = '00000000-0000-0000-0000-577000000c12'),
  true,
  'replace_recipe_contents now moves recipes.updated_at'
);

insert into public.labels (id, user_id, board_id, name)
values ('00000000-0000-0000-0000-577000000c18', '00000000-0000-0000-0000-577000000c01',
        (select board_id from public.board_columns where user_id = '00000000-0000-0000-0000-577000000c01' limit 1),
        'urgent');
insert into public.card_labels (user_id, card_id, label_id)
values ('00000000-0000-0000-0000-577000000c01', '00000000-0000-0000-0000-577000000c13',
        '00000000-0000-0000-0000-577000000c18');
select is(
  (select updated_at = now() from public.cards where id = '00000000-0000-0000-0000-577000000c13'),
  true,
  'attaching a label moves cards.updated_at'
);

alter table public.cards disable trigger user;
update public.cards set updated_at = now() - interval '1 hour';
alter table public.cards enable trigger user;
update public.labels set name = 'dringend' where id = '00000000-0000-0000-0000-577000000c18';
select is(
  (select updated_at = now() from public.cards where id = '00000000-0000-0000-0000-577000000c13'),
  true,
  'renaming a label moves the cards that carry it'
);

alter table public.cards disable trigger user;
update public.cards set updated_at = now() - interval '1 hour';
alter table public.cards enable trigger user;
delete from public.card_labels where label_id = '00000000-0000-0000-0000-577000000c18';
select is(
  (select updated_at = now() from public.cards where id = '00000000-0000-0000-0000-577000000c13'),
  true,
  'detaching a label moves cards.updated_at'
);

select * from finish();
rollback;
