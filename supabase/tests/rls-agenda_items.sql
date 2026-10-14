-- Tests for public.agenda_items (#484, ADR-0037 §1 / ADR-0033 / ADR-0009):
-- own items only, all four kinds, range bounds, link counts, time-zone day
-- boundary and the function's grants.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-484000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-484000000002', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-484000000001' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-484000000002' and is_default), true);

-- Window used below: [2030-06-10 00:00Z, 2030-06-17 00:00Z).
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values
  ('00000000-0000-0000-0000-484000000a01', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, 'A inside', '2030-06-12 10:00Z', '2030-06-12 11:00Z'),
  ('00000000-0000-0000-0000-484000000a02', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, 'A outside', '2030-07-01 10:00Z', '2030-07-01 11:00Z'),
  ('00000000-0000-0000-0000-484000000a03', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, 'A straddles start', '2030-06-09 23:00Z', '2030-06-10 01:00Z'),
  ('00000000-0000-0000-0000-484000000a04', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, 'A starts at end', '2030-06-17 00:00Z', '2030-06-17 01:00Z'),
  ('00000000-0000-0000-0000-484000000a05', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, 'A ends at start', '2030-06-09 23:00Z', '2030-06-10 00:00Z'),
  ('00000000-0000-0000-0000-484000000b01', '00000000-0000-0000-0000-484000000002',
   current_setting('test.b_cal')::uuid, 'B event', '2030-06-12 10:00Z', '2030-06-12 11:00Z');

insert into public.recipes (id, user_id, category_id, title, position, thumbnail_path)
values
  ('00000000-0000-0000-0000-484000000c01', '00000000-0000-0000-0000-484000000001',
   (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-484000000001' limit 1),
   'A pasta', 1000, 'a/pasta.webp'),
  ('00000000-0000-0000-0000-484000000c02', '00000000-0000-0000-0000-484000000002',
   (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-484000000002' limit 1),
   'B curry', 1000, null);

insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on, calendar_event_id)
values
  ('00000000-0000-0000-0000-484000000d01', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-484000000c01', 4, 'dinner', '2030-06-13', null),
  ('00000000-0000-0000-0000-484000000d02', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-484000000c01', 2, 'lunch', null,
   '00000000-0000-0000-0000-484000000a01'),
  ('00000000-0000-0000-0000-484000000d03', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-484000000c01', 2, 'dinner', '2030-07-01', null),
  ('00000000-0000-0000-0000-484000000d04', '00000000-0000-0000-0000-484000000001',
   current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-484000000c01', 2, 'dinner', null,
   '00000000-0000-0000-0000-484000000a02'),
  ('00000000-0000-0000-0000-484000000d05', '00000000-0000-0000-0000-484000000002',
   current_setting('test.b_cal')::uuid, '00000000-0000-0000-0000-484000000c02', 2, 'dinner', '2030-06-13', null);

insert into public.cards (id, user_id, column_id, title, position, planned_for, due_at)
values
  ('00000000-0000-0000-0000-484000000e01', '00000000-0000-0000-0000-484000000001',
   (select id from public.board_columns where user_id = '00000000-0000-0000-0000-484000000001' limit 1),
   'A planned and due', 1000, '2030-06-14', '2030-06-15 10:00Z'),
  ('00000000-0000-0000-0000-484000000e02', '00000000-0000-0000-0000-484000000001',
   (select id from public.board_columns where user_id = '00000000-0000-0000-0000-484000000001' limit 1),
   'A far away', 2000, '2030-08-01', '2030-08-02 10:00Z'),
  ('00000000-0000-0000-0000-484000000e03', '00000000-0000-0000-0000-484000000001',
   (select id from public.board_columns where user_id = '00000000-0000-0000-0000-484000000001' limit 1),
   'A just after midnight UTC', 3000, null, '2030-06-17 00:30Z'),
  ('00000000-0000-0000-0000-484000000e04', '00000000-0000-0000-0000-484000000001',
   (select id from public.board_columns where user_id = '00000000-0000-0000-0000-484000000001' limit 1),
   'A no dates', 4000, null, null),
  ('00000000-0000-0000-0000-484000000e05', '00000000-0000-0000-0000-484000000002',
   (select id from public.board_columns where user_id = '00000000-0000-0000-0000-484000000002' limit 1),
   'B card', 1000, '2030-06-14', '2030-06-15 10:00Z');

insert into public.calendar_event_links (calendar_event_id, card_id)
values ('00000000-0000-0000-0000-484000000a01', '00000000-0000-0000-0000-484000000e01');

-- Grants and shape (before switching roles).
select ok(
  has_function_privilege('authenticated', 'public.agenda_items(timestamptz, timestamptz, text)', 'EXECUTE'),
  'authenticated can execute agenda_items'
);
select ok(
  not has_function_privilege('anon', 'public.agenda_items(timestamptz, timestamptz, text)', 'EXECUTE'),
  'anon cannot execute agenda_items'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.agenda_items(timestamptz, timestamptz, text)'::regprocedure),
  false,
  'agenda_items is security invoker'
);
select is(
  (select provolatile from pg_proc where oid = 'public.agenda_items(timestamptz, timestamptz, text)'::regprocedure),
  's',
  'agenda_items is stable'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-484000000001", "role": "authenticated"}';

select is(
  (select array_agg(distinct kind order by kind)
   from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')),
  array['deadline', 'event', 'meal', 'planned_card'],
  'all four kinds are returned'
);
select is(
  (select count(*)::int from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where title in ('B event', 'B curry', 'B card')),
  0,
  'A sees none of B''s items'
);
select is(
  (select array_agg(id order by id) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where kind = 'event'),
  array['00000000-0000-0000-0000-484000000a01', '00000000-0000-0000-0000-484000000a03']::uuid[],
  'events: overlapping ones only; the range end is exclusive and an event ending at the start is out'
);
select is(
  (select array_agg(id order by id) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where kind = 'meal'),
  array['00000000-0000-0000-0000-484000000d01', '00000000-0000-0000-0000-484000000d02']::uuid[],
  'meals: a day plan and an attached plan inside the range, none outside'
);
select is(
  (select planned_on::text from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where id = '00000000-0000-0000-0000-484000000d01'),
  '2030-06-13',
  'a day plan carries planned_on'
);
select results_eq(
  $$ select planned_on is null, starts_at, ends_at, all_day
     from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
     where id = '00000000-0000-0000-0000-484000000d02' $$,
  $$ values (true, '2030-06-12 10:00Z'::timestamptz, '2030-06-12 11:00Z'::timestamptz, false) $$,
  'an attached plan takes its time from the event'
);
select results_eq(
  $$ select title, slot, servings, thumbnail_path
     from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
     where id = '00000000-0000-0000-0000-484000000d01' $$,
  $$ values ('A pasta', 'dinner', 4, 'a/pasta.webp') $$,
  'a meal carries the recipe title, slot, servings and thumbnail'
);
select is(
  (select array_agg(id order by id) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where kind = 'planned_card'),
  array['00000000-0000-0000-0000-484000000e01']::uuid[],
  'planned cards: only the one inside the range'
);
select results_eq(
  $$ select board_name is not null, column_name is not null
     from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
     where kind = 'planned_card' $$,
  $$ values (true, true) $$,
  'a planned card carries its board and column'
);
select is(
  (select array_agg(id order by id) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where kind = 'deadline'),
  array['00000000-0000-0000-0000-484000000e01']::uuid[],
  'deadlines: only the card due inside the range'
);
select is(
  (select link_count from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where id = '00000000-0000-0000-0000-484000000a01'),
  1,
  'an event counts its links'
);
select is(
  (select array_agg(link_count order by kind) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where id = '00000000-0000-0000-0000-484000000e01'),
  array[1, 1],
  'a card counts its links on both its planned and deadline rows'
);
select is(
  (select count(*)::int from public.agenda_items('2030-06-17 00:00Z', '2030-06-17 00:00Z', 'UTC')),
  0,
  'an empty range returns nothing'
);
select is(
  (select count(*)::int from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where id = '00000000-0000-0000-0000-484000000e03'),
  0,
  'a deadline at 00:30 UTC on the end day is outside the window in UTC'
);
select is(
  (select count(*)::int from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'Europe/Amsterdam')
   where id = '00000000-0000-0000-0000-484000000e03'),
  1,
  'the same deadline is 17 June 02:30 in Amsterdam, a day that began inside the window'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-484000000002", "role": "authenticated"}';
select is(
  (select array_agg(title order by title) from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')),
  array['B card', 'B card', 'B curry', 'B event'],
  'B sees only B''s items'
);

select * from finish();
rollback;
