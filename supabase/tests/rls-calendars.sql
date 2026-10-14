-- Two-user isolation test for calendars (#483, ADR-0037 / ADR-0035 /
-- ADR-0009): ownership policies, the seeded and undeletable default
-- calendar, and the kind / account consistency checks.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-483000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-483000000a02', 'b@test.local');

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-483000000c01', '00000000-0000-0000-0000-483000000a01', 'ics', 'A feed'),
       ('00000000-0000-0000-0000-483000000c02', '00000000-0000-0000-0000-483000000a02', 'ics', 'B feed');

select is(
  (select count(*)::int from public.calendars
   where user_id = '00000000-0000-0000-0000-483000000a01' and is_default and kind = 'manual'),
  1,
  'signup seeds exactly one default manual calendar'
);
select throws_ok(
  $$ insert into public.calendars (user_id, is_default)
     values ('00000000-0000-0000-0000-483000000a01', true) $$,
  '23505',
  null,
  'a second default calendar for the same user is rejected'
);
select throws_ok(
  $$ insert into public.calendars (user_id, kind)
     values ('00000000-0000-0000-0000-483000000a01', 'ics') $$,
  '23514',
  null,
  'a non-manual calendar needs an account'
);
select throws_ok(
  $$ insert into public.calendars (user_id, kind, calendar_account_id)
     values ('00000000-0000-0000-0000-483000000a01', 'manual',
             '00000000-0000-0000-0000-483000000c01') $$,
  '23514',
  null,
  'a manual calendar cannot have an account'
);
select throws_ok(
  $$ insert into public.calendars (user_id, kind, calendar_account_id, is_default)
     values ('00000000-0000-0000-0000-483000000a01', 'ics',
             '00000000-0000-0000-0000-483000000c01', true) $$,
  '23514',
  null,
  'an imported calendar cannot be the default'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000a01", "role": "authenticated"}';

select is((select count(*)::int from public.calendars), 1, 'A sees only their own calendar');
select is_empty(
  $$ select 1 from public.calendars where user_id = '00000000-0000-0000-0000-483000000a02' $$,
  'A cannot read B''s calendar'
);
select is_empty(
  $$ update public.calendars set name = 'gekaapt'
     where user_id = '00000000-0000-0000-0000-483000000a02' returning id $$,
  'A cannot update B''s calendar'
);
select is_empty(
  $$ delete from public.calendars
     where user_id = '00000000-0000-0000-0000-483000000a02' returning id $$,
  'A cannot delete B''s calendar'
);
select throws_ok(
  $$ insert into public.calendars (user_id, name)
     values ('00000000-0000-0000-0000-483000000a02', 'sneaky') $$,
  '42501',
  null,
  'A cannot create a calendar for B'
);
select throws_ok(
  $$ insert into public.calendars (user_id, name, is_default)
     values ('00000000-0000-0000-0000-483000000a01', 'tweede standaard', true) $$,
  '42501',
  null,
  'a client cannot create a default calendar'
);
select throws_ok(
  $$ update public.calendars set is_default = false $$,
  '42501',
  null,
  'a client cannot flip is_default'
);
select is_empty(
  $$ delete from public.calendars where is_default returning id $$,
  'the default calendar cannot be deleted'
);
select throws_ok(
  $$ insert into public.calendars (user_id, name, kind, calendar_account_id)
     values ('00000000-0000-0000-0000-483000000a01', 'andermans feed', 'ics',
             '00000000-0000-0000-0000-483000000c02') $$,
  '42501',
  null,
  'A cannot attach a calendar to B''s account'
);
select lives_ok(
  $$ insert into public.calendars (user_id, name, kind, calendar_account_id, position)
     values ('00000000-0000-0000-0000-483000000a01', 'Werk', 'ics',
             '00000000-0000-0000-0000-483000000c01', 2000) returning id $$,
  'A can create a calendar on their own account and read it back'
);
select lives_ok(
  $$ update public.calendars set name = 'Werk (Outlook)' where name = 'Werk' $$,
  'A can rename their own calendar'
);
select lives_ok(
  $$ delete from public.calendars where name = 'Werk (Outlook)' $$,
  'A can delete their own non-default calendar'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000a02", "role": "authenticated"}';
select is((select count(*)::int from public.calendars), 1, 'B still sees exactly their own calendar');

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendars $$,
  '42501',
  null,
  'anon has no access to calendars'
);

select * from finish();
rollback;
