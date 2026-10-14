-- Two-user isolation test for calendar_accounts (#483, ADR-0037 / ADR-0002 /
-- ADR-0009): own rows only, sync-owned columns are not writable by clients,
-- and deleting an account takes its calendars and synced events with it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-483000000b01', 'a@test.local'),
       ('00000000-0000-0000-0000-483000000b02', 'b@test.local');

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-483000000d01', '00000000-0000-0000-0000-483000000b01', 'ics', 'A feed'),
       ('00000000-0000-0000-0000-483000000d02', '00000000-0000-0000-0000-483000000b02', 'ics', 'B feed');
insert into public.calendars (id, user_id, name, kind, calendar_account_id)
values ('00000000-0000-0000-0000-483000000e01', '00000000-0000-0000-0000-483000000b01',
        'A feed', 'ics', '00000000-0000-0000-0000-483000000d01');
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at,
                                    source, calendar_account_id, external_id)
values ('00000000-0000-0000-0000-483000000f01', '00000000-0000-0000-0000-483000000b01',
        '00000000-0000-0000-0000-483000000e01', 'Synced', now(), now() + interval '1 hour',
        'sync', '00000000-0000-0000-0000-483000000d01', 'uid-1');

select throws_ok(
  $$ insert into public.calendar_accounts (user_id, provider, display_name)
     values ('00000000-0000-0000-0000-483000000b01', 'exchange', 'x') $$,
  '23514',
  null,
  'an unknown provider is rejected'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000b01", "role": "authenticated"}';

select is((select count(*)::int from public.calendar_accounts), 1, 'A sees only their own account');
select is_empty(
  $$ select 1 from public.calendar_accounts where user_id = '00000000-0000-0000-0000-483000000b02' $$,
  'A cannot read B''s account'
);
select is_empty(
  $$ update public.calendar_accounts set display_name = 'gekaapt'
     where user_id = '00000000-0000-0000-0000-483000000b02' returning id $$,
  'A cannot update B''s account'
);
select is_empty(
  $$ delete from public.calendar_accounts
     where user_id = '00000000-0000-0000-0000-483000000b02' returning id $$,
  'A cannot delete B''s account'
);
select throws_ok(
  $$ insert into public.calendar_accounts (user_id, provider, display_name)
     values ('00000000-0000-0000-0000-483000000b02', 'ics', 'sneaky') $$,
  '42501',
  null,
  'A cannot create an account for B'
);
select throws_ok(
  $$ insert into public.calendar_accounts (user_id, provider, display_name, vault_secret_id)
     values ('00000000-0000-0000-0000-483000000b01', 'ics', 'x', gen_random_uuid()) $$,
  '42501',
  null,
  'a client cannot set vault_secret_id'
);
select throws_ok(
  $$ update public.calendar_accounts set sync_state = '{"ok": true}'::jsonb $$,
  '42501',
  null,
  'a client cannot write sync_state'
);
select lives_ok(
  $$ update public.calendar_accounts set display_name = 'Outlook' returning id $$,
  'A can rename their own account'
);
select lives_ok(
  $$ insert into public.calendar_accounts (user_id, provider, display_name)
     values ('00000000-0000-0000-0000-483000000b01', 'caldav', 'iCloud') returning id $$,
  'A can create their own account'
);

delete from public.calendar_accounts where display_name = 'Outlook';
select is(
  (select count(*)::int from public.calendars where name = 'A feed'),
  0,
  'deleting an account cascades its calendar'
);
select is(
  (select count(*)::int from public.calendar_events where title = 'Synced'),
  0,
  'deleting an account cascades its synced events'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendar_accounts $$,
  '42501',
  null,
  'anon has no access to calendar_accounts'
);

select * from finish();
rollback;
