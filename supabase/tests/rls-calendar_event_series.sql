-- Two-user isolation, constraints, grants and scope behaviour for
-- calendar_event_series and the *_event_series RPCs (#531, ADR-0042 / ADR-0015 /
-- ADR-0009). Fixed dates sit in the past of the 400-day horizon on purpose, so
-- the counts do not depend on the day the suite runs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(91);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-531000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-531000000002', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-531000000001' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-531000000002' and is_default), true);

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-531000000111', '00000000-0000-0000-0000-531000000001', 'ics', 'A feed');
insert into public.calendars (id, user_id, name, kind, calendar_account_id)
values ('00000000-0000-0000-0000-531000000121', '00000000-0000-0000-0000-531000000001',
        'A feed', 'ics', '00000000-0000-0000-0000-531000000111');

insert into public.calendar_event_series (id, user_id, calendar_id, title, all_day, starts_on,
                                           start_time, duration_minutes, freq, until,
                                           materialized_until)
values ('00000000-0000-0000-0000-531000000a01', '00000000-0000-0000-0000-531000000001',
        current_setting('test.a_cal')::uuid, 'Basis', false, '2026-01-01', '09:00', 60,
        'daily', '2026-01-03', '2026-01-03');

-- ---- Constraints (as the table owner, so only the constraint can fire) -------
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq, "interval")
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-01', '09:00', 60, 'daily', 0) $$,
  '23514', null, 'an interval of 0 is rejected'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq, "interval")
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-01', '09:00', 60, 'daily', 100) $$,
  '23514', null, 'an interval of 100 is rejected'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-01', '09:00', 60, 'hourly') $$,
  '23514', null, 'an unknown freq is rejected'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq, until)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-10', '09:00', 60, 'daily', '2026-01-09') $$,
  '23514', null, 'a series cannot end before it starts'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, all_day, starts_on,
                                               duration_minutes, freq)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', true, '2026-01-01', 90, 'daily') $$,
  '23514', null, 'an all-day series lasts whole days'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, all_day, starts_on,
                                               start_time, duration_minutes, freq)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', true, '2026-01-01', '09:00', 1440, 'daily') $$,
  '23514', null, 'an all-day series has no start time'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on,
                                               duration_minutes, freq)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-01', 60, 'daily') $$,
  '23514', null, 'a timed series needs a start time'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq, description)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', '2026-01-01', '09:00', 60, 'daily', repeat('a', 2001)) $$,
  '23514', null, 'a description over 2000 characters is rejected'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at,
                                         source, calendar_account_id, external_id, series_id, occurrence_on)
     values ('00000000-0000-0000-0000-531000000001', '00000000-0000-0000-0000-531000000121',
             'x', now(), now(), 'sync', '00000000-0000-0000-0000-531000000111', 'uid-1',
             '00000000-0000-0000-0000-531000000a01', '2026-01-01') $$,
  '23514', null, 'a synced event cannot belong to a series'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, series_id)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', now(), now(), '00000000-0000-0000-0000-531000000a01') $$,
  '23514', null, 'series_id and occurrence_on are set together'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, series_detached)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', now(), now(), true) $$,
  '23514', null, 'only an occurrence can be detached'
);
select lives_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, series_id, occurrence_on)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'Basis', '2026-01-01 08:00Z', '2026-01-01 09:00Z',
             '00000000-0000-0000-0000-531000000a01', '2026-01-01') $$,
  'an occurrence row is accepted'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, series_id, occurrence_on)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'Basis', '2026-01-01 08:00Z', '2026-01-01 09:00Z',
             '00000000-0000-0000-0000-531000000a01', '2026-01-01') $$,
  '23505', null, 'a series has one occurrence per date'
);

-- ---- Grants and form of the RPCs ----------------------------------------------
create temporary view series_rpcs as
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_event_series', 'update_event_series', 'delete_event_series', 'extend_event_series');

select is((select count(*)::int from series_rpcs), 4, 'the four series RPCs exist');
select is(
  (select count(*)::int from series_rpcs where has_function_privilege('authenticated', oid, 'EXECUTE')),
  4,
  'authenticated can execute the series RPCs'
);
select is(
  (select count(*)::int from series_rpcs where has_function_privilege('anon', oid, 'EXECUTE')),
  0,
  'anon can execute none of the series RPCs'
);
select is(
  (select count(*)::int from series_rpcs s join pg_proc p on p.oid = s.oid
   where not p.prosecdef and p.proconfig::text like '%search_path%'),
  4,
  'the series RPCs are security invoker with a fixed search_path'
);

-- ---- Occurrences per rule (as A) ----------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-531000000001", "role": "authenticated"}';

select set_config('test.c1', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Dagelijks',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 1, p_until => '2026-01-10')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c1')::uuid)),
  10, 'daily: ten days give ten occurrences'
);

select set_config('test.c2', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Elke 3 dagen',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 3, p_until => '2026-01-10')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c2')::uuid)),
  4, 'daily every 3 days: 1, 4, 7 and 10 January'
);

select set_config('test.c3', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Wekelijks',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'weekly', 1, p_until => '2026-01-31')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c3')::uuid)),
  5, 'weekly: five Thursdays in January'
);

select set_config('test.c4', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Om de week',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'weekly', 2, p_until => '2026-01-31')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c4')::uuid)),
  3, 'weekly every two weeks: 1, 15 and 29 January'
);

select set_config('test.c5', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Maandelijks',
  '2026-01-15 08:00Z', '2026-01-15 09:00Z', false, 'monthly', 1, p_until => '2026-12-31')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c5')::uuid)),
  12, 'monthly on the 15th: twelve occurrences in a year'
);

select set_config('test.c6', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Elke 31e',
  '2026-01-31 08:00Z', '2026-01-31 09:00Z', false, 'monthly', 1, p_until => '2026-06-30')::text, true);
select is(
  (select array_agg(occurrence_on order by occurrence_on) from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c6')::uuid)),
  array['2026-01-31', '2026-03-31', '2026-05-31']::date[],
  'monthly on the 31st skips February, April and June'
);

select set_config('test.c7', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Schrikkeldag',
  '2020-02-29 08:00Z', '2020-02-29 09:00Z', false, 'yearly', 1, p_until => '2026-12-31')::text, true);
select is(
  (select array_agg(occurrence_on order by occurrence_on) from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c7')::uuid)),
  array['2020-02-29', '2024-02-29']::date[],
  'yearly on 29 February skips the years without it'
);

select set_config('test.c8', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Jaarlijks',
  '2022-03-10 08:00Z', '2022-03-10 09:00Z', false, 'yearly', 1, p_until => '2026-03-10')::text, true);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c8')::uuid)),
  5, 'yearly: the end date is inclusive'
);

select set_config('test.c9', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Vakantie',
  '2026-02-02 00:00Z', '2026-02-04 00:00Z', true, 'weekly', 1, p_until => '2026-02-16')::text, true);
select is(
  (select array_agg(to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD') order by occurrence_on)
   from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.c9')::uuid)),
  array['2026-02-04', '2026-02-11', '2026-02-18'],
  'an all-day series keeps its length in whole days (UTC midnights, exclusive end)'
);

-- ---- Wall-clock time across the daylight saving change (25 October 2026) ------
select set_config('test.dst', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Stand-up',
  '2026-10-24 07:00Z', '2026-10-24 08:00Z', false, 'daily', 1, p_until => '2026-10-26')::text, true);
select is(
  (select array_agg(starts_at order by occurrence_on) from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.dst')::uuid)),
  array['2026-10-24 07:00Z', '2026-10-25 08:00Z', '2026-10-26 08:00Z']::timestamptz[],
  '09:00 Amsterdam stays 09:00 over the change to winter time'
);
select is(
  (select array_agg(ends_at order by occurrence_on) from public.calendar_events
   where series_id = (select series_id from public.calendar_events where id = current_setting('test.dst')::uuid)),
  array['2026-10-24 08:00Z', '2026-10-25 09:00Z', '2026-10-26 09:00Z']::timestamptz[],
  'the end follows the wall clock too'
);

-- ---- An endless series, excluded dates and extension --------------------------
select set_config('test.x', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Eindeloos',
  (current_date::timestamp + time '09:00') at time zone 'Europe/Amsterdam',
  (current_date::timestamp + time '10:00') at time zone 'Europe/Amsterdam',
  false, 'daily', 1)::text, true);
select set_config('test.xs', (select series_id::text from public.calendar_events
  where id = current_setting('test.x')::uuid), true);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.xs')::uuid),
  401, 'an endless daily series holds today and the next 400 days'
);
select lives_ok(
  $$ select public.delete_event_series(
       (select id from public.calendar_events
        where series_id = current_setting('test.xs')::uuid and occurrence_on = current_date + 5),
       'this') $$,
  'one occurrence can be deleted on its own'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.xs')::uuid),
  400, 'only that occurrence is gone'
);
select is(
  (select excluded_on from public.calendar_event_series where id = current_setting('test.xs')::uuid),
  array[current_date + 5],
  'its date is remembered in excluded_on'
);

reset role;
update public.calendar_event_series set materialized_until = current_date + 2
  where id = current_setting('test.xs')::uuid;
delete from public.calendar_events
  where series_id = current_setting('test.xs')::uuid and occurrence_on > current_date + 2;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-531000000001", "role": "authenticated"}';

select is(public.extend_event_series(), 1, 'extension tops up the one series that fell short');
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.xs')::uuid),
  400, 'extension restores the horizon'
);
select is_empty(
  $$ select 1 from public.calendar_events
     where series_id = current_setting('test.xs')::uuid and occurrence_on = current_date + 5 $$,
  'extension does not bring back an excluded date'
);

-- ---- Errors (as A) ----------------------------------------------------------------
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-531000000e02', '00000000-0000-0000-0000-531000000001',
        current_setting('test.a_cal')::uuid, 'Los', '2026-03-01 08:00Z', '2026-03-01 09:00Z');

select throws_ok(
  $$ select public.create_event_series('00000000-0000-0000-0000-531000000121', 'x',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 1, p_until => '2026-01-03') $$,
  'AG403', null, 'a series cannot be created in an imported calendar'
);
select throws_ok(
  $$ select public.create_event_series(current_setting('test.a_cal')::uuid, 'x',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 1,
       p_until => '2026-01-03', p_time_zone => 'Mars/Olympus') $$,
  'AG422', null, 'an unknown time zone is rejected'
);
select throws_ok(
  $$ select public.create_event_series(current_setting('test.a_cal')::uuid, 'x',
       '2000-01-01 08:00Z', '2000-01-01 09:00Z', false, 'daily', 1) $$,
  'AG422', null, 'a series that would hold over 2000 occurrences is rejected'
);
select throws_ok(
  $$ select public.create_event_series(current_setting('test.a_cal')::uuid, 'x',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 0) $$,
  '23514', null, 'an interval of 0 is rejected by the RPC'
);
select throws_ok(
  $$ select public.create_event_series(current_setting('test.a_cal')::uuid, 'x',
       '2026-01-10 08:00Z', '2026-01-10 09:00Z', false, 'daily', 1, p_until => '2026-01-09') $$,
  '23514', null, 'an end before the start is rejected by the RPC'
);
select throws_ok(
  $$ select public.update_event_series(current_setting('test.c1')::uuid, 'sometimes', 'x',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false) $$,
  'AG422', null, 'an unknown scope is rejected on update'
);
select throws_ok(
  $$ select public.delete_event_series(current_setting('test.c1')::uuid, 'sometimes') $$,
  'AG422', null, 'an unknown scope is rejected on delete'
);
select throws_ok(
  $$ select public.update_event_series('00000000-0000-0000-0000-531000000e02', 'this', 'x',
       '2026-03-01 08:00Z', '2026-03-01 09:00Z', false) $$,
  'AG404', null, 'a single event is not an occurrence (update)'
);
select throws_ok(
  $$ select public.delete_event_series('00000000-0000-0000-0000-531000000e02', 'this') $$,
  'AG404', null, 'a single event is not an occurrence (delete)'
);

-- ---- Isolation between two users ------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-531000000002", "role": "authenticated"}';

select is((select count(*)::int from public.calendar_event_series), 0, 'B sees none of A''s series');
select throws_ok(
  $$ select public.update_event_series(current_setting('test.c1')::uuid, 'all', 'gekaapt',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, p_freq => 'daily', p_interval => 1) $$,
  'AG404', null, 'B cannot update an occurrence of A''s series'
);
select throws_ok(
  $$ select public.delete_event_series(current_setting('test.c1')::uuid, 'all') $$,
  'AG404', null, 'B cannot delete A''s series'
);
select throws_ok(
  $$ select public.create_event_series(current_setting('test.a_cal')::uuid, 'sneaky',
       '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 1, p_until => '2026-01-03') $$,
  'AG404', null, 'B cannot create a series in A''s calendar'
);
select throws_ok(
  $$ insert into public.calendar_event_series (user_id, calendar_id, title, starts_on, start_time,
                                               duration_minutes, freq)
     values ('00000000-0000-0000-0000-531000000002', current_setting('test.a_cal')::uuid,
             'sneaky', '2026-01-01', '09:00', 60, 'daily') $$,
  '42501', null, 'B cannot insert a series into A''s calendar'
);
select is_empty(
  $$ update public.calendar_event_series set title = 'gekaapt' returning id $$,
  'B cannot update A''s series'
);
select is_empty(
  $$ delete from public.calendar_event_series returning id $$,
  'B cannot delete A''s series directly'
);
select is(public.extend_event_series(), 0, 'B''s extension leaves A''s series alone');

select set_config('test.b1', public.create_event_series(
  current_setting('test.b_cal')::uuid, 'B reeks',
  '2026-01-01 08:00Z', '2026-01-01 09:00Z', false, 'daily', 1, p_until => '2026-01-03')::text, true);
select set_config('test.bs', (select series_id::text from public.calendar_events
  where id = current_setting('test.b1')::uuid), true);
select is((select count(*)::int from public.calendar_event_series), 1, 'B sees only their own series');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-531000000001", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, series_id, occurrence_on)
     values ('00000000-0000-0000-0000-531000000001', current_setting('test.a_cal')::uuid,
             'x', now(), now(), current_setting('test.bs')::uuid, '2026-05-05') $$,
  '42501', null, 'A cannot create an event in B''s series'
);
select throws_ok(
  $$ update public.calendar_events
     set series_id = current_setting('test.bs')::uuid, occurrence_on = '2026-05-05'
     where id = '00000000-0000-0000-0000-531000000e02' $$,
  '42501', null, 'A cannot move an event into B''s series'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.xs')::uuid),
  400, 'A''s series is intact after B''s attempts'
);

-- ---- Scopes: a weekly series from two weeks ago to two weeks ahead ---------------------
select set_config('test.p1', public.create_event_series(
  current_setting('test.a_cal')::uuid, 'Oud',
  ((current_date - 14)::timestamp + time '09:00') at time zone 'Europe/Amsterdam',
  ((current_date - 14)::timestamp + time '10:00') at time zone 'Europe/Amsterdam',
  false, 'weekly', 1, p_until => current_date + 14)::text, true);
select set_config('test.p', (select series_id::text from public.calendar_events
  where id = current_setting('test.p1')::uuid), true);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.p')::uuid),
  5, 'the weekly series has five occurrences'
);

-- Alleen deze: the row itself, which becomes detached.
select lives_ok(
  $$ select public.update_event_series(
       (select id from public.calendar_events
        where series_id = current_setting('test.p')::uuid and occurrence_on = current_date + 14),
       'this', 'Los',
       ((current_date + 14)::timestamp + time '09:00') at time zone 'Europe/Amsterdam',
       ((current_date + 14)::timestamp + time '10:00') at time zone 'Europe/Amsterdam',
       false, p_location => 'Kantoor') $$,
  'this: one occurrence can be changed on its own'
);
select is(
  (select array_agg(title || ':' || series_detached::text order by occurrence_on)
   from public.calendar_events where series_id = current_setting('test.p')::uuid),
  array['Oud:false', 'Oud:false', 'Oud:false', 'Oud:false', 'Los:true'],
  'this: only that row changed, and it is detached'
);

-- Alle: from today on, detached rows and history stay.
select set_config('test.p7', (select id::text from public.calendar_events
  where series_id = current_setting('test.p')::uuid and occurrence_on = current_date + 7), true);
select lives_ok(
  $$ select public.update_event_series(
       current_setting('test.p7')::uuid, 'all', 'Nieuw',
       ((current_date + 7)::timestamp + time '10:00') at time zone 'Europe/Amsterdam',
       ((current_date + 7)::timestamp + time '11:00') at time zone 'Europe/Amsterdam',
       false, p_freq => 'weekly', p_interval => 1, p_until => current_date + 14) $$,
  'all: the series can be changed from an occurrence'
);
select is(
  (select array_agg(title order by occurrence_on) from public.calendar_events
   where series_id = current_setting('test.p')::uuid),
  array['Oud', 'Oud', 'Nieuw', 'Nieuw', 'Los'],
  'all: past occurrences and the detached one keep their title'
);
select is(
  (select array_agg((starts_at at time zone 'Europe/Amsterdam')::time order by occurrence_on)
   from public.calendar_events where series_id = current_setting('test.p')::uuid),
  array['09:00', '09:00', '10:00', '10:00', '09:00']::time[],
  'all: the new time applies from today on'
);
select is(
  (select start_time from public.calendar_event_series where id = current_setting('test.p')::uuid),
  '10:00'::time, 'all: the series holds the new template'
);
select is(
  (select occurrence_on from public.calendar_events where id = current_setting('test.p7')::uuid),
  current_date + 7, 'all: occurrences keep their id'
);

-- Deze en volgende: the old series ends, a new one starts, ids stay.
select lives_ok(
  $$ select public.update_event_series(
       current_setting('test.p7')::uuid, 'following', 'Vanaf',
       ((current_date + 7)::timestamp + time '11:00') at time zone 'Europe/Amsterdam',
       ((current_date + 7)::timestamp + time '12:00') at time zone 'Europe/Amsterdam',
       false, p_freq => 'weekly', p_interval => 1, p_until => current_date + 21) $$,
  'following: this and the later occurrences can be changed'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.p')::uuid),
  3, 'following: the old series keeps the earlier occurrences'
);
select is(
  (select until from public.calendar_event_series where id = current_setting('test.p')::uuid),
  current_date + 6, 'following: the old series ends the day before'
);
select set_config('test.n', (select series_id::text from public.calendar_events
  where id = current_setting('test.p7')::uuid), true);
select isnt(
  current_setting('test.n')::uuid, current_setting('test.p')::uuid,
  'following: the occurrence moved to a new series and kept its id'
);
select is(
  (select array_agg(title || '@' || to_char(occurrence_on - current_date, 'FM99') order by occurrence_on)
   from public.calendar_events where series_id = current_setting('test.n')::uuid),
  array['Vanaf@7', 'Los@14', 'Vanaf@21'],
  'following: the new series has one row per date, the detached one included'
);

-- Deze en volgende on the first occurrence: the series changes in place.
select lives_ok(
  $$ select public.update_event_series(
       current_setting('test.p7')::uuid, 'following', 'Eerste',
       ((current_date + 7)::timestamp + time '11:00') at time zone 'Europe/Amsterdam',
       ((current_date + 7)::timestamp + time '12:00') at time zone 'Europe/Amsterdam',
       false, p_freq => 'weekly', p_interval => 1, p_until => current_date + 21) $$,
  'following on the first occurrence changes the series itself'
);
select is(
  (select count(*)::int from public.calendar_event_series where starts_on = current_date + 7),
  1, 'following on the first occurrence adds no series'
);
select is(
  (select array_agg(title order by occurrence_on) from public.calendar_events
   where series_id = current_setting('test.n')::uuid),
  array['Eerste', 'Los', 'Eerste'],
  'following on the first occurrence: the detached row stays'
);

-- Verwijderen per scope.
select lives_ok(
  $$ select public.delete_event_series(
       (select id from public.calendar_events
        where series_id = current_setting('test.n')::uuid and occurrence_on = current_date + 21),
       'this') $$,
  'delete this: one occurrence'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.n')::uuid),
  2, 'delete this: the series keeps its other occurrences'
);
select is(
  (select excluded_on from public.calendar_event_series where id = current_setting('test.n')::uuid),
  array[current_date + 21], 'delete this: the date is excluded'
);

select lives_ok(
  $$ select public.delete_event_series(
       (select id from public.calendar_events
        where series_id = current_setting('test.p')::uuid and occurrence_on = current_date),
       'following') $$,
  'delete following: today and later'
);
select is(
  (select array_agg(occurrence_on - current_date order by occurrence_on) from public.calendar_events
   where series_id = current_setting('test.p')::uuid),
  array[-14, -7], 'delete following: the earlier occurrences stay'
);
select is(
  (select until from public.calendar_event_series where id = current_setting('test.p')::uuid),
  current_date - 1, 'delete following: the series ends the day before'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.n')::uuid),
  2, 'delete following: another series is untouched'
);

select lives_ok(
  $$ select public.delete_event_series(
       (select id from public.calendar_events
        where series_id = current_setting('test.p')::uuid and occurrence_on = current_date - 14),
       'following') $$,
  'delete following on the first occurrence'
);
select is(
  (select count(*)::int from public.calendar_event_series where id = current_setting('test.p')::uuid),
  0, 'delete following on the first occurrence removes the series'
);

select lives_ok(
  $$ select public.delete_event_series(current_setting('test.p7')::uuid, 'all') $$,
  'delete all: the whole series'
);
select is(
  (select count(*)::int from public.calendar_events where series_id = current_setting('test.n')::uuid),
  0, 'delete all: every occurrence goes, history and detached ones too'
);
select is(
  (select count(*)::int from public.calendar_event_series where id = current_setting('test.n')::uuid),
  0, 'delete all: the series row goes'
);

-- ---- Dragging detaches; a single event can become the first occurrence --------------
select lives_ok(
  $$ update public.calendar_events
     set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day', series_detached = true
     where id = current_setting('test.c3')::uuid $$,
  'a client can drag an occurrence and detach it'
);

select is(
  public.create_event_series(
    current_setting('test.a_cal')::uuid, 'Eenmalig',
    '2026-03-01 08:00Z', '2026-03-01 09:00Z', false, 'weekly', 1,
    p_until => '2026-03-22', p_event_id => '00000000-0000-0000-0000-531000000e02'),
  '00000000-0000-0000-0000-531000000e02'::uuid,
  'a single event becomes the first occurrence and keeps its id'
);
select is(
  (select count(*)::int from public.calendar_events
   where series_id = (select series_id from public.calendar_events
                      where id = '00000000-0000-0000-0000-531000000e02')),
  4, 'the converted event gets its follow-up occurrences'
);

-- ---- The timeline marks occurrences ---------------------------------------------------
select is(
  (select series_id from public.agenda_items('2026-01-01 00:00Z', '2026-01-02 00:00Z', 'UTC')
   where kind = 'event' and id = current_setting('test.c1')::uuid),
  (select series_id from public.calendar_events where id = current_setting('test.c1')::uuid),
  'agenda_items carries series_id for an occurrence'
);
select is(
  (select series_id from public.agenda_items('2026-03-15 00:00Z', '2026-03-16 00:00Z', 'UTC')
   where kind = 'event' and title = 'Eenmalig'),
  (select series_id from public.calendar_events where id = '00000000-0000-0000-0000-531000000e02'),
  'agenda_items carries series_id for a converted event'
);

-- ---- anon ---------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendar_event_series $$,
  '42501', null, 'anon has no access to calendar_event_series'
);
select throws_ok(
  $$ select public.extend_event_series() $$,
  '42501', null, 'anon cannot call the series RPCs'
);

select * from finish();
rollback;
