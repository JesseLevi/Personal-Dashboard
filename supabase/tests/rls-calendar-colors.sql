-- Colour, grants and RPCs of the calendar categories (#532, ADR-0040 / ADR-0042 /
-- ADR-0015 / ADR-0009): the colour check and default, the update grants, and
-- delete_calendar_moving_contents / move_event_calendar for the owner and a
-- second user. Series dates sit in the past of the 400-day horizon on purpose.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-532000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-532000000002', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-532000000001' and is_default), true);

-- ---- Default colours (as the table owner) -------------------------------------
select is(
  (select color from public.calendars where id = current_setting('test.a_cal')::uuid),
  'blue', 'the seeded default calendar is blue'
);

insert into public.calendars (id, user_id, name)
values ('00000000-0000-0000-0000-532000000c01', '00000000-0000-0000-0000-532000000001', 'Sociaal');
select is(
  (select color from public.calendars where id = '00000000-0000-0000-0000-532000000c01'),
  'red', 'a new calendar takes the first colour the user does not use'
);

insert into public.calendars (id, user_id, name)
values ('00000000-0000-0000-0000-532000000c02', '00000000-0000-0000-0000-532000000001', 'Sport');
select is(
  (select color from public.calendars where id = '00000000-0000-0000-0000-532000000c02'),
  'orange', 'the next calendar takes the next free colour'
);

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-532000000a01', '00000000-0000-0000-0000-532000000001', 'ics', 'Feed');
insert into public.calendars (id, user_id, name, kind, calendar_account_id)
values ('00000000-0000-0000-0000-532000000c03', '00000000-0000-0000-0000-532000000001',
        'Feed', 'ics', '00000000-0000-0000-0000-532000000a01');
select is(
  (select color from public.calendars where id = '00000000-0000-0000-0000-532000000c03'),
  'amber', 'an imported calendar also takes the next free colour'
);

insert into public.calendars (user_id, name, color)
values ('00000000-0000-0000-0000-532000000001', 'Gekozen', 'stone');
select is(
  (select color from public.calendars where name = 'Gekozen'),
  'stone', 'a colour given on insert is kept'
);

select throws_ok(
  $$ insert into public.calendars (user_id, name, color)
     values ('00000000-0000-0000-0000-532000000001', 'x', 'purple') $$,
  '23514', null, 'a colour outside the palette is rejected'
);

-- All nine used once: the tenth calendar falls back to the first (a multi-row insert sees its own rows).
insert into public.calendars (user_id, name)
select '00000000-0000-0000-0000-532000000002', 'c' || g from generate_series(1, 9) as g;
select is(
  (select count(*)::int from public.calendars
   where user_id = '00000000-0000-0000-0000-532000000002' and color = 'red'),
  2, 'with every colour in use, the least used (first in order) is taken again'
);
select is(
  (select count(distinct color)::int from public.calendars
   where user_id = '00000000-0000-0000-0000-532000000002'),
  9, 'the first nine calendars of a user cover the whole palette'
);

-- ---- Grants and form --------------------------------------------------------
select ok(has_column_privilege('authenticated', 'public.calendars', 'color', 'UPDATE'),
  'authenticated can update calendars.color');
select ok(not has_column_privilege('anon', 'public.calendars', 'color', 'UPDATE'),
  'anon cannot update calendars.color');
select ok(has_column_privilege('authenticated', 'public.calendar_events', 'calendar_id', 'UPDATE'),
  'authenticated can update calendar_events.calendar_id');
select ok(has_column_privilege('authenticated', 'public.calendar_event_series', 'calendar_id', 'UPDATE'),
  'authenticated can update calendar_event_series.calendar_id');
select ok(has_column_privilege('authenticated', 'public.meal_plans', 'calendar_id', 'UPDATE'),
  'authenticated can update meal_plans.calendar_id');
select ok(not has_column_privilege('authenticated', 'public.calendars', 'is_default', 'UPDATE'),
  'is_default stays immutable for clients');

create temporary view category_rpcs as
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('delete_calendar_moving_contents', 'move_event_calendar');

select is((select count(*)::int from category_rpcs), 2, 'the two category RPCs exist');
select is(
  (select count(*)::int from category_rpcs where has_function_privilege('authenticated', oid, 'EXECUTE')),
  2, 'authenticated can execute the category RPCs'
);
select is(
  (select count(*)::int from category_rpcs where has_function_privilege('anon', oid, 'EXECUTE')),
  0, 'anon can execute none of the category RPCs'
);
select is(
  (select count(*)::int from category_rpcs s join pg_proc p on p.oid = s.oid
   where not p.prosecdef and p.proconfig::text like '%search_path%'),
  2, 'the category RPCs are security invoker with a fixed search_path'
);

-- ---- Contents of the calendar that is deleted --------------------------------
insert into public.recipes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-532000000211', '00000000-0000-0000-0000-532000000001',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-532000000001' limit 1),
        'A pasta', 1000);
insert into public.cards (id, user_id, column_id, title, position)
values ('00000000-0000-0000-0000-532000000251', '00000000-0000-0000-0000-532000000001',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-532000000001' limit 1),
        'A kaart', 1000);

insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-532000000e01', '00000000-0000-0000-0000-532000000001',
        '00000000-0000-0000-0000-532000000c01', 'Film', '2026-01-02 19:00Z', '2026-01-02 21:00Z');
insert into public.calendar_event_links (user_id, calendar_event_id, card_id)
values ('00000000-0000-0000-0000-532000000001', '00000000-0000-0000-0000-532000000e01',
        '00000000-0000-0000-0000-532000000251');
insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on)
values ('00000000-0000-0000-0000-532000000f01', '00000000-0000-0000-0000-532000000001',
        '00000000-0000-0000-0000-532000000c01', '00000000-0000-0000-0000-532000000211', 2, 'dinner', '2026-01-03');
insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
values ('00000000-0000-0000-0000-532000000f02', '00000000-0000-0000-0000-532000000001',
        '00000000-0000-0000-0000-532000000c01', '00000000-0000-0000-0000-532000000211', 2, 'dinner',
        '00000000-0000-0000-0000-532000000e01');

-- Events for the move tests.
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-532000000e02', '00000000-0000-0000-0000-532000000001',
        current_setting('test.a_cal')::uuid, 'Padel', '2026-01-04 19:00Z', '2026-01-04 20:00Z');
insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
values ('00000000-0000-0000-0000-532000000f03', '00000000-0000-0000-0000-532000000001',
        current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-532000000211', 2, 'dinner',
        '00000000-0000-0000-0000-532000000e02');
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at, source,
                                    calendar_account_id, external_id)
values ('00000000-0000-0000-0000-532000000e03', '00000000-0000-0000-0000-532000000001',
        '00000000-0000-0000-0000-532000000c03', 'Geïmporteerd', '2026-01-05 09:00Z', '2026-01-05 10:00Z',
        'sync', '00000000-0000-0000-0000-532000000a01', 'uid-532');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-532000000001", "role": "authenticated"}';

select set_config('test.s1_first', public.create_event_series(
  '00000000-0000-0000-0000-532000000c01', 'Wekelijks',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'weekly', 1, p_until => date '2026-01-29')::text, true);
select set_config('test.s1', (select series_id::text from public.calendar_events
  where id = current_setting('test.s1_first')::uuid), true);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.s1')::uuid),
  5, 'the calendar to delete holds a series of five occurrences'
);

select throws_ok(
  $$ select public.delete_calendar_moving_contents(current_setting('test.a_cal')::uuid) $$,
  'AG403', null, 'the default calendar cannot be deleted'
);
select throws_ok(
  $$ select public.delete_calendar_moving_contents('00000000-0000-0000-0000-532000000c03') $$,
  'AG403', null, 'an imported calendar cannot be deleted this way'
);
select throws_ok(
  $$ select public.delete_calendar_moving_contents('00000000-0000-0000-0000-532000000999') $$,
  'AG404', null, 'an unknown calendar is not found'
);

select lives_ok(
  $$ select public.delete_calendar_moving_contents('00000000-0000-0000-0000-532000000c01') $$,
  'A deletes the calendar Sociaal'
);
select is_empty(
  $$ select 1 from public.calendars where id = '00000000-0000-0000-0000-532000000c01' $$,
  'the calendar is gone'
);
select is(
  (select calendar_id from public.calendar_events where id = '00000000-0000-0000-0000-532000000e01'),
  current_setting('test.a_cal')::uuid, 'its event moved to the default calendar'
);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = current_setting('test.s1')::uuid and calendar_id = current_setting('test.a_cal')::uuid),
  5, 'every occurrence of its series moved'
);
select is(
  (select calendar_id from public.calendar_event_series where id = current_setting('test.s1')::uuid),
  current_setting('test.a_cal')::uuid, 'the series moved to the default calendar'
);
select is(
  (select count(*)::int from public.meal_plans
   where id in ('00000000-0000-0000-0000-532000000f01', '00000000-0000-0000-0000-532000000f02')
     and calendar_id = current_setting('test.a_cal')::uuid),
  2, 'its meal plans moved, the attached one included'
);
select is(
  (select count(*)::int from public.calendar_event_links
   where calendar_event_id = '00000000-0000-0000-0000-532000000e01'),
  1, 'the links of a moved event stay'
);
select lives_ok(
  $$ update public.meal_plans set servings = 3 where id = '00000000-0000-0000-0000-532000000f02' $$,
  'an attached meal plan stays editable after the move'
);

-- ---- B cannot touch A's calendars ---------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-532000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.delete_calendar_moving_contents('00000000-0000-0000-0000-532000000c02') $$,
  'AG404', null, 'B cannot delete A''s calendar'
);
select throws_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02',
       (select id from public.calendars where user_id = '00000000-0000-0000-0000-532000000002' and is_default)) $$,
  'AG404', null, 'B cannot move A''s event'
);
select is_empty(
  $$ update public.calendars set color = 'pink' where id = '00000000-0000-0000-0000-532000000c02' returning id $$,
  'B cannot recolour A''s calendar'
);

-- ---- Moving an event (as A) ----------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-532000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.calendars where id = '00000000-0000-0000-0000-532000000c02'),
  1, 'A''s other calendar survived B''s attempt'
);
select lives_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02', '00000000-0000-0000-0000-532000000c02') $$,
  'A moves a single event to Sport'
);
select is(
  (select calendar_id from public.calendar_events where id = '00000000-0000-0000-0000-532000000e02'),
  '00000000-0000-0000-0000-532000000c02'::uuid, 'the event is in Sport'
);
select is(
  (select calendar_id from public.meal_plans where id = '00000000-0000-0000-0000-532000000f03'),
  '00000000-0000-0000-0000-532000000c02'::uuid, 'its attached meal plan followed'
);
select lives_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02', '00000000-0000-0000-0000-532000000c02') $$,
  'moving to the calendar it is already in does nothing'
);
select throws_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02', '00000000-0000-0000-0000-532000000c03') $$,
  'AG403', null, 'an event cannot move into an imported calendar'
);
select throws_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e03', '00000000-0000-0000-0000-532000000c02') $$,
  'AG403', null, 'an imported event cannot move'
);
select throws_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02', '00000000-0000-0000-0000-532000000999') $$,
  'AG404', null, 'an unknown target calendar is not found'
);
select throws_ok(
  $$ select public.move_event_calendar('00000000-0000-0000-0000-532000000e02', current_setting('test.a_cal')::uuid, 'some') $$,
  'AG422', null, 'an unknown scope is rejected'
);

-- ---- Moving occurrences of a series ---------------------------------------------
select set_config('test.t1', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Maandag',
  '2026-02-02 08:00Z', '2026-02-02 09:00Z', false, 'weekly', 1, p_until => date '2026-03-02')::text, true);
select set_config('test.t_series', (select series_id::text from public.calendar_events
  where id = current_setting('test.t1')::uuid), true);
select set_config('test.t2', (select id::text from public.calendar_events
  where series_id = current_setting('test.t_series')::uuid and occurrence_on = '2026-02-09'), true);
select set_config('test.t3', (select id::text from public.calendar_events
  where series_id = current_setting('test.t_series')::uuid and occurrence_on = '2026-02-16'), true);

select lives_ok(
  $$ select public.move_event_calendar(current_setting('test.t2')::uuid, '00000000-0000-0000-0000-532000000c02', 'this') $$,
  'A moves one occurrence'
);
select is(
  (select series_id from public.calendar_events where id = current_setting('test.t2')::uuid),
  null, 'the moved occurrence left its series'
);
select is(
  (select calendar_id from public.calendar_events where id = current_setting('test.t2')::uuid),
  '00000000-0000-0000-0000-532000000c02'::uuid, 'and is in the new calendar'
);
select ok(
  (select '2026-02-09'::date = any (excluded_on) from public.calendar_event_series
   where id = current_setting('test.t_series')::uuid),
  'its date is excluded so extension does not bring it back'
);

select lives_ok(
  $$ select public.move_event_calendar(current_setting('test.t3')::uuid, '00000000-0000-0000-0000-532000000c02', 'following') $$,
  'A moves an occurrence and the ones after it'
);
select is(
  (select count(*)::int from public.calendar_events e
   join public.calendar_event_series s on s.id = e.series_id
   where e.occurrence_on >= '2026-02-16' and s.calendar_id = '00000000-0000-0000-0000-532000000c02'
     and e.calendar_id = '00000000-0000-0000-0000-532000000c02'
     and e.series_id <> current_setting('test.t_series')::uuid
     and e.title = 'Maandag'),
  3, 'three occurrences sit in a new series of the new calendar'
);
select is(
  (select until from public.calendar_event_series where id = current_setting('test.t_series')::uuid),
  '2026-02-15'::date, 'the old series ends the day before'
);
select lives_ok(
  $$ update public.calendar_events set starts_at = '2026-02-16 10:00Z', ends_at = '2026-02-16 11:00Z'
     where id = current_setting('test.t3')::uuid $$,
  'a moved occurrence stays editable'
);

select set_config('test.u1', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Dagelijks',
  '2026-03-01 08:00Z', '2026-03-01 09:00Z', false, 'daily', 1, p_until => date '2026-03-03')::text, true);
select lives_ok(
  $$ select public.move_event_calendar(current_setting('test.u1')::uuid, '00000000-0000-0000-0000-532000000c02', 'all') $$,
  'A moves a whole series'
);
select is(
  (select count(*)::int from public.calendar_events e
   join public.calendar_event_series s on s.id = e.series_id
   where e.series_id = (select series_id from public.calendar_events where id = current_setting('test.u1')::uuid)
     and e.calendar_id = '00000000-0000-0000-0000-532000000c02'
     and s.calendar_id = '00000000-0000-0000-0000-532000000c02'),
  3, 'all three occurrences and the series are in the new calendar'
);

-- ---- Recolouring (as A) ----------------------------------------------------------
select lives_ok(
  $$ update public.calendars set color = 'pink' where id = '00000000-0000-0000-0000-532000000c02' $$,
  'A recolours their own calendar'
);
select is(
  (select color from public.calendars where id = '00000000-0000-0000-0000-532000000c02'),
  'pink', 'the new colour is stored'
);
select throws_ok(
  $$ update public.calendars set color = 'purple' where id = '00000000-0000-0000-0000-532000000c02' $$,
  '23514', null, 'a colour outside the palette is rejected for a client too'
);

select * from finish();
rollback;
