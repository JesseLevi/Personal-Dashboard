-- Two-user isolation test for calendar_sync_notices (#490, ADR-0037 §6 /
-- ADR-0009): the owner reads and dismisses (deletes) a notice; nobody writes
-- one from a client, and deleting the account takes its notices with it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-490000000b01', 'a@test.local'),
       ('00000000-0000-0000-0000-490000000b02', 'b@test.local');

insert into public.calendar_accounts (id, user_id, provider, display_name)
values ('00000000-0000-0000-0000-490000000d01', '00000000-0000-0000-0000-490000000b01', 'ics', 'A feed'),
       ('00000000-0000-0000-0000-490000000d02', '00000000-0000-0000-0000-490000000b02', 'ics', 'B feed');

insert into public.calendar_sync_notices (id, user_id, calendar_account_id, event_title, item_ids)
values ('00000000-0000-0000-0000-490000000e01', '00000000-0000-0000-0000-490000000b01',
        '00000000-0000-0000-0000-490000000d01', 'A etentje', array[gen_random_uuid()]),
       ('00000000-0000-0000-0000-490000000e02', '00000000-0000-0000-0000-490000000b02',
        '00000000-0000-0000-0000-490000000d02', 'B etentje', array[gen_random_uuid()]);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-490000000b01", "role": "authenticated"}';

select is((select count(*)::int from public.calendar_sync_notices), 1, 'A sees only their own notice');
select is_empty(
  $$ select 1 from public.calendar_sync_notices where user_id = '00000000-0000-0000-0000-490000000b02' $$,
  'A cannot read B''s notice'
);
select throws_ok(
  $$ insert into public.calendar_sync_notices (user_id, calendar_account_id, event_title, item_ids)
     values ('00000000-0000-0000-0000-490000000b01', '00000000-0000-0000-0000-490000000d01', 'verzonnen', '{}') $$,
  '42501',
  null,
  'a client cannot write a notice'
);
select throws_ok(
  $$ update public.calendar_sync_notices set event_title = 'gekaapt' $$,
  '42501',
  null,
  'a client cannot edit a notice'
);
select is_empty(
  $$ delete from public.calendar_sync_notices
     where user_id = '00000000-0000-0000-0000-490000000b02' returning id $$,
  'A cannot dismiss B''s notice'
);
select lives_ok(
  $$ delete from public.calendar_sync_notices where id = '00000000-0000-0000-0000-490000000e01' $$,
  'A can dismiss their own notice'
);
select is((select count(*)::int from public.calendar_sync_notices), 0, 'the dismissed notice is gone');

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.calendar_sync_notices $$,
  '42501',
  null,
  'anon has no access to calendar_sync_notices'
);

reset role;
insert into public.calendar_sync_notices (user_id, calendar_account_id, event_title, item_ids)
values ('00000000-0000-0000-0000-490000000b01', '00000000-0000-0000-0000-490000000d01', 'nog een', '{}');
delete from public.calendar_accounts where id = '00000000-0000-0000-0000-490000000d01';
select is(
  (select count(*)::int from public.calendar_sync_notices where event_title = 'nog een'),
  0,
  'deleting an account cascades its notices'
);

select * from finish();
rollback;
