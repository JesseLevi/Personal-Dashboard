-- Two-user isolation + sync-field protection test for calendar_events
-- (#483, ADR-0037 / ADR-0035 / ADR-0005 / ADR-0009).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-483000000101', 'a@test.local'),
       ('00000000-0000-0000-0000-483000000102', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000101' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000102' and is_default), true);

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-483000000111', '00000000-0000-0000-0000-483000000101', 'ics', 'A feed');
insert into public.calendars (id, user_id, name, kind, calendar_account_id)
values ('00000000-0000-0000-0000-483000000121', '00000000-0000-0000-0000-483000000101',
        'A feed', 'ics', '00000000-0000-0000-0000-483000000111');

insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-483000000b01', '00000000-0000-0000-0000-483000000102',
        current_setting('test.b_cal')::uuid, 'B afspraak', now(), now() + interval '1 hour');
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at,
                                    source, calendar_account_id, external_id, content_hash)
values ('00000000-0000-0000-0000-483000000a02', '00000000-0000-0000-0000-483000000101',
        '00000000-0000-0000-0000-483000000121', 'Synced', now(), now() + interval '1 hour',
        'sync', '00000000-0000-0000-0000-483000000111', 'uid-1', 'h1');

-- Constraints (run as the table owner so only the constraint can fire).
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at,
                                         source, calendar_account_id, external_id)
     values ('00000000-0000-0000-0000-483000000101', '00000000-0000-0000-0000-483000000121',
             'dubbel', now(), now(), 'sync', '00000000-0000-0000-0000-483000000111', 'uid-1') $$,
  '23505',
  null,
  'the same external_id cannot be imported twice per account'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, external_id)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'x', now(), now(), 'uid-9') $$,
  '23514',
  null,
  'a manual event cannot carry an external_id'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, source)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'x', now(), now(), 'sync') $$,
  '23514',
  null,
  'a synced event needs an account and an external_id'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'x', now(), now() - interval '1 hour') $$,
  '23514',
  null,
  'an event cannot end before it starts'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, description)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'x', now(), now(), repeat('a', 2001)) $$,
  '23514',
  null,
  'a description over 2000 characters is rejected'
);
select lives_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, description)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'x', now(), now(), repeat('a', 2000)) $$,
  'a description of exactly 2000 characters is accepted'
);
delete from public.calendar_events where title = 'x';

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000101", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at, location)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'Tandarts', now() + interval '1 day', now() + interval '1 day 1 hour', 'Utrecht')
     returning id $$,
  'A can create a manual event and read it back'
);
select is((select count(*)::int from public.calendar_events), 2, 'A sees only their own events');
select is_empty(
  $$ select 1 from public.calendar_events where title = 'B afspraak' $$,
  'A cannot read B''s event'
);
select is_empty(
  $$ update public.calendar_events set title = 'gekaapt'
     where id = '00000000-0000-0000-0000-483000000b01' returning id $$,
  'A cannot update B''s event'
);
select is_empty(
  $$ delete from public.calendar_events
     where id = '00000000-0000-0000-0000-483000000b01' returning id $$,
  'A cannot delete B''s event'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.b_cal')::uuid,
             'sneaky', now(), now()) $$,
  '42501',
  null,
  'A cannot create an event in B''s calendar'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at,
                                         source, calendar_account_id, external_id)
     values ('00000000-0000-0000-0000-483000000101', current_setting('test.a_cal')::uuid,
             'vals', now(), now(), 'sync', '00000000-0000-0000-0000-483000000111', 'uid-2') $$,
  '42501',
  null,
  'a client cannot create a synced event'
);
select lives_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at)
     values ('00000000-0000-0000-0000-483000000102', current_setting('test.a_cal')::uuid,
             'user_id wordt gecorrigeerd', now(), now()) $$,
  'a wrong user_id on insert is overwritten by the calendar owner'
);
select is(
  (select user_id from public.calendar_events where title = 'user_id wordt gecorrigeerd'),
  '00000000-0000-0000-0000-483000000101'::uuid,
  'events carry the calendar owner as user_id'
);

-- A manual event is fully editable.
select lives_ok(
  $$ update public.calendar_events set title = 'Tandarts 2', all_day = true
     where title = 'Tandarts' $$,
  'A can edit a manual event'
);

-- Source fields of a synced event are read-only for the user.
select throws_ok(
  $$ update public.calendar_events set title = 'anders'
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  '42501',
  null,
  'a client cannot change the title of a synced event'
);
select throws_ok(
  $$ update public.calendar_events set starts_at = now() + interval '5 days'
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  '42501',
  null,
  'a client cannot move a synced event'
);
select throws_ok(
  $$ update public.calendar_events set description = 'x'
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  '42501',
  null,
  'a client cannot change the description of a synced event'
);
select throws_ok(
  $$ update public.calendar_events set calendar_id = current_setting('test.a_cal')::uuid
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  '42501',
  null,
  'a client cannot move a synced event to another calendar'
);
select throws_ok(
  $$ update public.calendar_events set source = 'manual', external_id = null
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  '42501',
  null,
  'a client cannot change sync-owned columns'
);

-- Deleting a calendar takes its events with it.
insert into public.calendars (user_id, name, position)
values ('00000000-0000-0000-0000-483000000101', 'Tijdelijk', 2000);
insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at)
select user_id, id, 'Tijdelijke afspraak', now(), now() from public.calendars where name = 'Tijdelijk';
delete from public.calendars where name = 'Tijdelijk';
select is(
  (select count(*)::int from public.calendar_events where title = 'Tijdelijke afspraak'),
  0,
  'deleting a calendar cascades its events'
);

-- B sees only their own.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000102", "role": "authenticated"}';
select is((select count(*)::int from public.calendar_events), 1, 'B sees only their own event');

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendar_events $$,
  '42501',
  null,
  'anon has no access to calendar_events'
);

-- Trusted code (the table owner here, service_role in production) can still
-- write the source fields of a synced event.
reset role;
select lives_ok(
  $$ update public.calendar_events set title = 'Bijgewerkt door sync', content_hash = 'h2'
     where id = '00000000-0000-0000-0000-483000000a02' $$,
  'trusted code can update a synced event'
);

select * from finish();
rollback;
