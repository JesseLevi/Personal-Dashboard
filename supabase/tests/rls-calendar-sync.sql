-- #490 (ADR-0037 §5-6, ADR-0039, ADR-0002): create_ics_calendar,
-- get_calendar_account_secret and apply_calendar_sync.
--   * the secret URL lives in Vault, readable only by its owner (or service_role)
--   * a failed, empty or halved feed deletes nothing
--   * a missing event is marked first and deleted only on the second miss
--   * a returning event is un-marked; events behind the window are kept
--   * a deleted event cascades its links and meal plan, and the open basket
--     items of that meal plan end up in a notice
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-490000000c01', 'a@test.local'),
       ('00000000-0000-0000-0000-490000000c02', 'b@test.local');

-- Test helpers (rolled back with the transaction). test_feed builds a payload:
-- one event per id, a day apart; p_changed gets a new title and hash.
create function public.test_feed(p_ids text[], p_changed text default '')
returns jsonb
language sql
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'external_id', t.id,
    'title', 'Event ' || t.id || case when t.id = p_changed then ' (bewerkt)' else '' end,
    'starts_at', timestamptz '2026-10-20 10:00:00+00' + (t.ord::int * interval '1 day'),
    'ends_at', timestamptz '2026-10-20 11:00:00+00' + (t.ord::int * interval '1 day'),
    'all_day', false,
    'location', null::text,
    'description', null::text,
    'content_hash', md5(t.id || case when t.id = p_changed then 'x' else '' end)
  ) order by t.ord), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(id, ord)
$$;

create function public.test_apply(p_ids text[], p_changed text default '', p_failure text default null)
returns jsonb
language sql
as $$
  select public.apply_calendar_sync(
    current_setting('test.acc')::uuid,
    public.test_feed(p_ids, p_changed),
    timestamptz '2026-09-14 00:00:00+00',
    timestamptz '2027-11-18 00:00:00+00',
    p_failure)
$$;

grant execute on function public.test_feed(text[], text), public.test_apply(text[], text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Creating an account: Vault, ownership, input checks
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-490000000c01", "role": "authenticated"}';

select set_config('test.acc',
  public.create_ics_calendar('Werk', 'https://example.com/secret-a.ics')::text, true);

select is(
  (select count(*)::int from public.calendar_accounts
    where id = current_setting('test.acc')::uuid and provider = 'ics' and display_name = 'Werk'),
  1,
  'A can create an ICS account'
);
select is(
  (select count(*)::int from public.calendars
    where calendar_account_id = current_setting('test.acc')::uuid and kind = 'ics' and name = 'Werk'),
  1,
  'the account has its own calendar'
);
select is(
  (select vault_secret_id is not null from public.calendar_accounts
    where id = current_setting('test.acc')::uuid),
  true,
  'the account references a Vault secret'
);
select is(
  public.get_calendar_account_secret(current_setting('test.acc')::uuid),
  'https://example.com/secret-a.ics',
  'A reads their own secret URL'
);
select throws_ok(
  $$ select public.create_ics_calendar('Zonder tls', 'http://example.com/a.ics') $$,
  '22023', null, 'a plain http URL is refused'
);
select throws_ok(
  $$ select public.create_ics_calendar('   ', 'https://example.com/a.ics') $$,
  '22023', null, 'a blank name is refused'
);
select throws_ok(
  $$ select count(*) from vault.decrypted_secrets $$,
  '42501', null, 'a client cannot read the Vault'
);
select is(
  (select count(*)::int from public.calendar_accounts where sync_state::text like '%secret-a%'),
  0,
  'the URL is in no column'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-490000000c02", "role": "authenticated"}';

select is(
  public.get_calendar_account_secret(current_setting('test.acc')::uuid),
  null,
  'B cannot read A''s secret URL'
);
select throws_ok(
  $$ select public.apply_calendar_sync(current_setting('test.acc')::uuid, '[]'::jsonb, now(), now()) $$,
  '42501', null, 'B cannot apply a sync to A''s account'
);
select throws_ok(
  $$ select public.apply_calendar_sync(gen_random_uuid(), '[]'::jsonb, now(), now()) $$,
  '42501', null, 'an unknown account answers like a foreign one'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.create_ics_calendar('x', 'https://example.com/a.ics') $$,
  '42501', null, 'anon cannot create an account'
);
select throws_ok(
  $$ select public.get_calendar_account_secret(gen_random_uuid()) $$,
  '42501', null, 'anon cannot read a secret'
);
select throws_ok(
  $$ select public.apply_calendar_sync(gen_random_uuid(), '[]'::jsonb, now(), now()) $$,
  '42501', null, 'anon cannot apply a sync'
);

-- service_role (the cron route) has no user, and reads any account.
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select is(
  public.get_calendar_account_secret(current_setting('test.acc')::uuid),
  'https://example.com/secret-a.ics',
  'service_role reads the secret for the cron route'
);

-- ---------------------------------------------------------------------------
-- Fixtures that clients cannot write: an event behind the window
-- ---------------------------------------------------------------------------

reset role;
insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at,
                                    source, calendar_account_id, external_id, content_hash)
select user_id, id, 'Lang geleden', '2026-01-01 10:00+00', '2026-01-01 11:00+00',
       'sync', calendar_account_id, 'old', 'h-old'
from public.calendars where calendar_account_id = current_setting('test.acc')::uuid;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-490000000c01", "role": "authenticated"}';

-- ---------------------------------------------------------------------------
-- Upsert and identity
-- ---------------------------------------------------------------------------

select is(
  (public.test_apply(array['e1', 'e2', 'e3', 'e4']))->>'status',
  'ok',
  'a first feed is applied'
);
select is(
  (select count(*)::int from public.calendar_events
    where calendar_account_id = current_setting('test.acc')::uuid and external_id like 'e%'),
  4,
  'its events are stored'
);
select is(
  (select last_synced_at is not null and sync_state->>'status' = 'ok'
     from public.calendar_accounts where id = current_setting('test.acc')::uuid),
  true,
  'sync_state and last_synced_at record the success'
);
select is(
  (public.test_apply(array['e1', 'e2', 'e3', 'e4']))->>'written',
  '0',
  'an unchanged feed writes nothing'
);

select set_config('test.e1', (select id::text from public.calendar_events where external_id = 'e1'), true);
select is(
  (public.test_apply(array['e1', 'e2', 'e3', 'e4'], 'e1'))->>'written',
  '1',
  'a changed event is written, and only that one'
);
select is(
  (select title || '|' || (id = current_setting('test.e1')::uuid)::text
     from public.calendar_events where external_id = 'e1'),
  'Event e1 (bewerkt)|true',
  'the event is updated in place and keeps its id'
);

-- ---------------------------------------------------------------------------
-- Failures delete nothing
-- ---------------------------------------------------------------------------

select is((public.test_apply(array[]::text[]))->>'error', 'empty', 'an empty feed fails');
select is(
  (select sync_state->>'status' || '/' || (sync_state->>'error')
     from public.calendar_accounts where id = current_setting('test.acc')::uuid),
  'failed/empty',
  'the failure is recorded in sync_state'
);
select is((public.test_apply(array['e1'], '', 'fetch_timeout'))->>'error', 'fetch_timeout', 'a failed fetch is reported');
select is((public.test_apply(array['e1']))->>'error', 'drop', 'a feed that lost more than half fails');
select is((public.test_apply(array['e1'], '', 'x y; drop table'))->>'error', 'fetch_failed', 'a free-text failure is not stored');
select is(
  (select count(*)::int from public.calendar_events
    where calendar_account_id = current_setting('test.acc')::uuid and missing_since is not null),
  0,
  'no failure marks or deletes anything'
);
select is(
  (select count(*)::int from public.calendar_events where calendar_account_id = current_setting('test.acc')::uuid),
  5,
  'all events are still there after the failures'
);

-- ---------------------------------------------------------------------------
-- Two misses delete; coming back un-marks
-- ---------------------------------------------------------------------------

select is((public.test_apply(array['e1', 'e2', 'e3']))->>'marked', '1', 'a missing event is marked first');
select is(
  (select missing_since is not null from public.calendar_events where external_id = 'e4'),
  true,
  'missing_since is set'
);
select is(
  (select count(*)::int from public.calendar_events where external_id = 'e4'),
  1,
  'the event is not deleted yet'
);

select is((public.test_apply(array['e1', 'e2', 'e3', 'e4']))->>'status', 'ok', 'the event comes back');
select is(
  (select missing_since is null from public.calendar_events where external_id = 'e4'),
  true,
  'missing_since is cleared'
);

-- A meal plan on e4, an open and a checked basket item from it, and a link.
select set_config('test.e4', (select id::text from public.calendar_events where external_id = 'e4'), true);
select set_config('test.cal', (select calendar_id::text from public.calendar_events where external_id = 'e4'), true);
insert into public.recipes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-490000000f01', '00000000-0000-0000-0000-490000000c01',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-490000000c01' limit 1),
        'Lasagne', 1000);
insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
values ('00000000-0000-0000-0000-490000000f02', '00000000-0000-0000-0000-490000000c01',
        current_setting('test.cal')::uuid, '00000000-0000-0000-0000-490000000f01', 4, 'dinner',
        current_setting('test.e4')::uuid);
insert into public.shopping_list_items (id, user_id, name, position, meal_plan_id, checked)
values ('00000000-0000-0000-0000-490000000f11', '00000000-0000-0000-0000-490000000c01', 'Pasta', 1000,
        '00000000-0000-0000-0000-490000000f02', false),
       ('00000000-0000-0000-0000-490000000f12', '00000000-0000-0000-0000-490000000c01', 'Kaas', 2000,
        '00000000-0000-0000-0000-490000000f02', true);
insert into public.notes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-490000000f21', '00000000-0000-0000-0000-490000000c01',
        (select id from public.note_categories where user_id = '00000000-0000-0000-0000-490000000c01' limit 1),
        'Notitie', 1000);
insert into public.calendar_event_links (calendar_event_id, note_id)
values (current_setting('test.e4')::uuid, '00000000-0000-0000-0000-490000000f21');

select is((public.test_apply(array['e1', 'e2', 'e3']))->>'marked', '1', 'e4 is marked again');
select is((public.test_apply(array['e1', 'e2', 'e3']))->>'deleted', '1', 'the second miss deletes it');
select is(
  (select count(*)::int from public.calendar_events where external_id = 'e4'),
  0,
  'the event is gone'
);
select is(
  (select count(*)::int from public.calendar_events where external_id = 'old'),
  1,
  'an event behind the window is kept'
);
select is(
  (select count(*)::int from public.meal_plans where id = '00000000-0000-0000-0000-490000000f02'),
  0,
  'its meal plan went with it'
);
select is(
  (select count(*)::int from public.calendar_event_links),
  0,
  'its links went with it'
);

-- ---------------------------------------------------------------------------
-- Basket notice: the open items only, never removed by the sync
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.shopping_list_items
    where id in ('00000000-0000-0000-0000-490000000f11', '00000000-0000-0000-0000-490000000f12')
      and meal_plan_id is null),
  2,
  'both basket items survive'
);
select is(
  (select event_title || '|' || item_ids::text from public.calendar_sync_notices
    where calendar_account_id = current_setting('test.acc')::uuid),
  'Event e4|{00000000-0000-0000-0000-490000000f11}',
  'one notice lists the event title and only the open item'
);

-- ---------------------------------------------------------------------------
-- The Vault secret goes with the account
-- ---------------------------------------------------------------------------

reset role;
select set_config('test.secret',
  (select vault_secret_id::text from public.calendar_accounts where id = current_setting('test.acc')::uuid), true);
delete from public.calendar_accounts where id = current_setting('test.acc')::uuid;
select is(
  (select count(*)::int from vault.secrets where id = current_setting('test.secret')::uuid),
  0,
  'deleting the account deletes its Vault secret'
);

select * from finish();
rollback;
