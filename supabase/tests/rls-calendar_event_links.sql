-- Two-user isolation + cascade test for calendar_event_links (#483,
-- ADR-0037 / ADR-0009): the exclusive arc, both ends must be readable, and
-- deleting an event never deletes what it linked to.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-483000000301', 'a@test.local'),
       ('00000000-0000-0000-0000-483000000302', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000301' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000302' and is_default), true);

insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-483000000311', '00000000-0000-0000-0000-483000000301',
        current_setting('test.a_cal')::uuid, 'A event', now(), now() + interval '1 hour'),
       ('00000000-0000-0000-0000-483000000312', '00000000-0000-0000-0000-483000000301',
        current_setting('test.a_cal')::uuid, 'A event 2', now(), now() + interval '1 hour'),
       ('00000000-0000-0000-0000-483000000313', '00000000-0000-0000-0000-483000000302',
        current_setting('test.b_cal')::uuid, 'B event', now(), now() + interval '1 hour');

insert into public.cards (id, user_id, column_id, title, position)
values ('00000000-0000-0000-0000-483000000321', '00000000-0000-0000-0000-483000000301',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-483000000301' limit 1),
        'A kaart', 1000),
       ('00000000-0000-0000-0000-483000000322', '00000000-0000-0000-0000-483000000302',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-483000000302' limit 1),
        'B kaart', 1000);
insert into public.recipes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-483000000331', '00000000-0000-0000-0000-483000000301',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-483000000301' limit 1),
        'A recept', 1000),
       ('00000000-0000-0000-0000-483000000332', '00000000-0000-0000-0000-483000000302',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-483000000302' limit 1),
        'B recept', 1000);
insert into public.notes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-483000000341', '00000000-0000-0000-0000-483000000301',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-483000000301' limit 1),
        'A notitie', 1000),
       ('00000000-0000-0000-0000-483000000342', '00000000-0000-0000-0000-483000000302',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-483000000302' limit 1),
        'B notitie', 1000);

-- B's own link, plus a link from A's event to B's card that only the table
-- owner could have created.
insert into public.calendar_event_links (id, user_id, calendar_event_id, card_id)
values ('00000000-0000-0000-0000-483000000351', '00000000-0000-0000-0000-483000000302',
        '00000000-0000-0000-0000-483000000313', '00000000-0000-0000-0000-483000000322'),
       ('00000000-0000-0000-0000-483000000352', '00000000-0000-0000-0000-483000000301',
        '00000000-0000-0000-0000-483000000312', '00000000-0000-0000-0000-483000000322');

select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, card_id, recipe_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311',
             '00000000-0000-0000-0000-483000000321', '00000000-0000-0000-0000-483000000331') $$,
  '23514',
  null,
  'a link cannot have two targets'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311') $$,
  '23514',
  null,
  'a link needs a target'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000301", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, card_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311',
             '00000000-0000-0000-0000-483000000321') returning id $$,
  'A can link their event to their card'
);
select lives_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, recipe_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311',
             '00000000-0000-0000-0000-483000000331') returning id $$,
  'A can link their event to their recipe'
);
select lives_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, note_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311',
             '00000000-0000-0000-0000-483000000341') returning id $$,
  'A can link their event to their note'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, card_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000311',
             '00000000-0000-0000-0000-483000000321') $$,
  '23505',
  null,
  'the same target cannot be linked twice to one event'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, card_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000312',
             '00000000-0000-0000-0000-483000000322') $$,
  '42501',
  null,
  'A cannot link to B''s card'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, recipe_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000312',
             '00000000-0000-0000-0000-483000000332') $$,
  '42501',
  null,
  'A cannot link to B''s recipe'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, note_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000312',
             '00000000-0000-0000-0000-483000000342') $$,
  '42501',
  null,
  'A cannot link to B''s note'
);
select throws_ok(
  $$ insert into public.calendar_event_links (user_id, calendar_event_id, card_id)
     values ('00000000-0000-0000-0000-483000000301', '00000000-0000-0000-0000-483000000313',
             '00000000-0000-0000-0000-483000000321') $$,
  '42501',
  null,
  'A cannot link from B''s event'
);
select is((select count(*)::int from public.calendar_event_links), 3, 'A sees only their own links');
select is_empty(
  $$ select 1 from public.calendar_event_links where id = '00000000-0000-0000-0000-483000000351' $$,
  'A cannot read B''s link'
);
select is_empty(
  $$ select 1 from public.calendar_event_links where id = '00000000-0000-0000-0000-483000000352' $$,
  'a link to a target A cannot read stays hidden, even on A''s own event'
);
select is_empty(
  $$ delete from public.calendar_event_links
     where id = '00000000-0000-0000-0000-483000000351' returning id $$,
  'A cannot delete B''s link'
);
select throws_ok(
  $$ update public.calendar_event_links set card_id = null,
       recipe_id = '00000000-0000-0000-0000-483000000331'
     where card_id = '00000000-0000-0000-0000-483000000321' $$,
  '42501',
  null,
  'a link cannot be retargeted, only deleted'
);

-- Deleting a link or a target leaves the other end alone.
delete from public.cards where id = '00000000-0000-0000-0000-483000000321';
select is(
  (select count(*)::int from public.calendar_event_links
   where calendar_event_id = '00000000-0000-0000-0000-483000000311'),
  2,
  'deleting a card cascades its link'
);

-- Deleting the event removes its links but not the recipe or the note.
delete from public.calendar_events where id = '00000000-0000-0000-0000-483000000311';
select is(
  (select count(*)::int from public.calendar_event_links
   where calendar_event_id = '00000000-0000-0000-0000-483000000311'),
  0,
  'deleting an event cascades its links'
);
select is(
  (select count(*)::int from public.recipes where id = '00000000-0000-0000-0000-483000000331'),
  1,
  'deleting an event does not delete the linked recipe'
);
select is(
  (select count(*)::int from public.notes where id = '00000000-0000-0000-0000-483000000341'),
  1,
  'deleting an event does not delete the linked note'
);

-- A's card is already gone, so check that an event delete leaves a card alone
-- on B's side, as the table owner.
reset role;
delete from public.calendar_events where id = '00000000-0000-0000-0000-483000000313';
select is(
  (select count(*)::int from public.cards where id = '00000000-0000-0000-0000-483000000322'),
  1,
  'deleting an event does not delete the linked card'
);
select is(
  (select count(*)::int from public.calendar_event_links where id = '00000000-0000-0000-0000-483000000351'),
  0,
  'the link went with B''s event'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000302", "role": "authenticated"}';
select is((select count(*)::int from public.calendar_event_links), 0, 'B sees none of A''s links');

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendar_event_links $$,
  '42501',
  null,
  'anon has no access to calendar_event_links'
);

select * from finish();
rollback;
