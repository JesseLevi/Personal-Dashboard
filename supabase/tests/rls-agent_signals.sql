-- agent_signals (#624, ADR-0046): isolation, no client writes, the status RPC,
-- the run throttle, both rhythm detectors on fixed activity_events fixtures,
-- and set_ai_enabled(false) deleting pattern signals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-624000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-624000000b01', 'b@test.local'),
       ('00000000-0000-0000-0000-624000000c01', 'c@test.local');

-- Noon, Europe/Amsterdam, n calendar days ago.
create function pg_temp.d(n int) returns timestamptz
language sql as $$
  select (((now() at time zone 'Europe/Amsterdam')::date - n) + time '12:00') at time zone 'Europe/Amsterdam'
$$;

insert into public.recipes (id, user_id, category_id, title, position)
select v.id::uuid, '00000000-0000-0000-0000-624000000a01',
       (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-624000000a01' limit 1),
       v.title, 1000
from (values
  ('00000000-0000-0000-0000-624000000d01', 'R1 op de drempel'),
  ('00000000-0000-0000-0000-624000000d02', 'R2 net eronder'),
  ('00000000-0000-0000-0000-624000000d03', 'R3 twee keer'),
  ('00000000-0000-0000-0000-624000000d04', 'R4 ingepland'),
  ('00000000-0000-0000-0000-624000000d05', 'R5 vloer van 21 dagen'),
  ('00000000-0000-0000-0000-624000000d06', 'R6 later ingepland')
) as v(id, title);

-- Buy fixtures for A: four purchase days ten days apart unless noted.
-- melk, rijst: last purchase 9 days ago = round(0.85 * 10), exactly on the threshold.
-- kaas: 8 days ago, under it. thee: three purchases. brood: median 3, under 5.
-- boter: due, but an unchecked item is in the basket.
insert into public.activity_events (user_id, kind, occurred_at, item_key, item_name)
select '00000000-0000-0000-0000-624000000a01', 'basket_item_checked', pg_temp.d(v.n), v.k, v.name
from (values
  ('melk', 'Melk', 39), ('melk', 'Melk', 29), ('melk', 'Melk', 19), ('melk', 'Melk', 9),
  ('rijst', 'Rijst', 39), ('rijst', 'Rijst', 29), ('rijst', 'Rijst', 19), ('rijst', 'Rijst', 9),
  ('kaas', 'Kaas', 38), ('kaas', 'Kaas', 28), ('kaas', 'Kaas', 18), ('kaas', 'Kaas', 8),
  ('thee', 'Thee', 40), ('thee', 'Thee', 30), ('thee', 'Thee', 20),
  ('brood', 'Brood', 12), ('brood', 'Brood', 9), ('brood', 'Brood', 6), ('brood', 'Brood', 3),
  ('boter', 'Boter', 39), ('boter', 'Boter', 29), ('boter', 'Boter', 19), ('boter', 'Boter', 9)
) as v(k, name, n);
insert into public.shopping_list_items (user_id, name, position)
values ('00000000-0000-0000-0000-624000000a01', 'Boter', 1000);

-- Cook fixtures for A. R1, R6: three cooks 30 days apart, last one 60 days ago =
-- greatest(2 * 30, 21). R2: 59. R3: two cooks. R4: due but planned. R5: median 5,
-- last 21 days ago = the 21-day floor.
insert into public.activity_events (user_id, kind, occurred_at, recipe_id)
select '00000000-0000-0000-0000-624000000a01', 'recipe_cooked', pg_temp.d(v.n), v.r::uuid
from (values
  ('00000000-0000-0000-0000-624000000d01', 120), ('00000000-0000-0000-0000-624000000d01', 90), ('00000000-0000-0000-0000-624000000d01', 60),
  ('00000000-0000-0000-0000-624000000d02', 119), ('00000000-0000-0000-0000-624000000d02', 89), ('00000000-0000-0000-0000-624000000d02', 59),
  ('00000000-0000-0000-0000-624000000d03', 120), ('00000000-0000-0000-0000-624000000d03', 60),
  ('00000000-0000-0000-0000-624000000d04', 120), ('00000000-0000-0000-0000-624000000d04', 90), ('00000000-0000-0000-0000-624000000d04', 60),
  ('00000000-0000-0000-0000-624000000d05', 31), ('00000000-0000-0000-0000-624000000d05', 26), ('00000000-0000-0000-0000-624000000d05', 21),
  ('00000000-0000-0000-0000-624000000d06', 120), ('00000000-0000-0000-0000-624000000d06', 90), ('00000000-0000-0000-0000-624000000d06', 60)
) as v(r, n);

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-624000000a01' and is_default), true);
insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
values ('00000000-0000-0000-0000-624000000a01', current_setting('test.a_cal')::uuid,
        '00000000-0000-0000-0000-624000000d04', 2, 'dinner', current_date + 1);

-- C: six buy items, one more overdue than the next, for the cap of five.
insert into public.activity_events (user_id, kind, occurred_at, item_key, item_name)
select '00000000-0000-0000-0000-624000000c01', 'basket_item_checked', pg_temp.d(g.n + c.i + 9), 'c' || c.i, 'C' || c.i
from generate_series(1, 6) as c(i), (values (30), (20), (10), (0)) as g(n)
where true;

-- Closed rows for the prune check, a pattern for the opt-out check, and a B row.
insert into public.agent_signals (user_id, kind, dedupe_key, payload, message, status, status_changed_at)
values ('00000000-0000-0000-0000-624000000a01', 'pattern', 'old', '{}', 'oud', 'dismissed', now() - interval '181 days'),
       ('00000000-0000-0000-0000-624000000a01', 'pattern', 'recent', '{}', 'recent', 'skipped', now() - interval '179 days'),
       ('00000000-0000-0000-0000-624000000a01', 'pattern', 'open', '{}', 'open', 'new', now()),
       ('00000000-0000-0000-0000-624000000b01', 'pattern', 'b-open', '{}', 'b', 'new', now());

select throws_ok(
  $$ insert into public.agent_signals (user_id, kind, dedupe_key, payload, message)
     values ('00000000-0000-0000-0000-624000000a01', 'pattern', 'long', '{}', repeat('x', 401)) $$,
  '23514', null, 'a message over 400 characters is refused'
);
select throws_ok(
  $$ insert into public.agent_signals (user_id, kind, dedupe_key, payload)
     values ('00000000-0000-0000-0000-624000000a01', 'stuck_card', 'x', '{}') $$,
  '23514', null, 'an unknown kind is refused'
);
select throws_ok(
  $$ insert into public.agent_signals (user_id, kind, dedupe_key, payload)
     values ('00000000-0000-0000-0000-624000000a01', 'pattern', 'open', '{}') $$,
  '23505', null, 'user_id, kind and dedupe_key are unique'
);

-- Grants -----------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.agent_signals', 'SELECT')
  and not has_table_privilege('authenticated', 'public.agent_signals', 'INSERT')
  and not has_table_privilege('authenticated', 'public.agent_signals', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.agent_signals', 'DELETE'),
  'authenticated may select agent_signals but not insert, update or delete'
);
select ok(
  not has_table_privilege('anon', 'public.agent_signals', 'SELECT')
  and not has_table_privilege('anon', 'public.agent_signals', 'INSERT'),
  'anon has no privilege on agent_signals'
);
select ok(
  has_function_privilege('authenticated', 'public.set_agent_signal_status(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.set_agent_signal_status(uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.claim_assistant_run()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.claim_assistant_run()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.detect_rhythm_signals()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.detect_rhythm_signals()', 'EXECUTE'),
  'the member-facing functions are executable by authenticated, never by anon'
);
select ok(
  has_function_privilege('service_role', 'public.detect_rhythm_signals_for(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.detect_rhythm_signals_for(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.detect_rhythm_signals_for(uuid)', 'EXECUTE'),
  'detect_rhythm_signals_for is executable by service_role only'
);
select ok(
  not has_function_privilege('authenticated', 'private.detect_rhythm_signals(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.buy_rhythm_candidates(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.cook_rhythm_candidates(uuid)', 'EXECUTE'),
  'the private detector functions are not executable by authenticated'
);

-- Isolation and no client writes --------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000b01", "role": "authenticated"}';

select results_eq(
  $$ select dedupe_key from public.agent_signals $$,
  $$ values ('b-open') $$,
  'B sees only their own signals'
);
select throws_ok(
  $$ insert into public.agent_signals (user_id, kind, dedupe_key, payload)
     values ('00000000-0000-0000-0000-624000000b01', 'pattern', 'mine', '{}') $$,
  '42501', null, 'authenticated cannot insert'
);
select throws_ok(
  $$ update public.agent_signals set status = 'acted' $$,
  '42501', null, 'authenticated cannot update'
);
select throws_ok(
  $$ delete from public.agent_signals $$,
  '42501', null, 'authenticated cannot delete'
);
select throws_ok(
  $$ select * from private.assistant_runs $$,
  '42501', null, 'authenticated cannot read the run throttle table'
);

-- Throttle -------------------------------------------------------------------

select is(public.claim_assistant_run(), true, 'first claim succeeds');
select is(public.claim_assistant_run(), false, 'a second claim within 6 hours is refused');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000c01", "role": "authenticated"}';
select is(public.claim_assistant_run(), true, 'the throttle is per member');

reset role;
update private.assistant_runs set last_run_at = now() - interval '5 hours 59 minutes'
  where user_id = '00000000-0000-0000-0000-624000000c01';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000c01", "role": "authenticated"}';
select is(public.claim_assistant_run(), false, 'still refused just under 6 hours');

reset role;
update private.assistant_runs set last_run_at = now() - interval '6 hours 1 minute'
  where user_id = '00000000-0000-0000-0000-624000000c01';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000c01", "role": "authenticated"}';
select is(public.claim_assistant_run(), true, 'claimed again after 6 hours');

-- Cap of five per kind, most overdue first -------------------------------------

select is(public.detect_rhythm_signals(), 5, 'six due items give five new signals');
select ok(
  not exists (select 1 from public.agent_signals where kind = 'buy_rhythm' and dedupe_key like 'c1:%')
  and exists (select 1 from public.agent_signals where kind = 'buy_rhythm' and dedupe_key like 'c6:%'),
  'the least overdue item is left out, the most overdue is in'
);
select is(public.detect_rhythm_signals(), 1, 'the next run adds the sixth');

-- Detectors for A ---------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000a01", "role": "authenticated"}';

select is(public.detect_rhythm_signals(), 5, 'A: two buy and three cook signals');
select results_eq(
  $$ select split_part(dedupe_key, ':', 1) from public.agent_signals
     where kind = 'buy_rhythm' order by 1 $$,
  $$ values ('melk'), ('rijst') $$,
  'buy: on the threshold fires; under it, too few purchases, median under 5 and an item in the basket do not'
);
select results_eq(
  $$ select split_part(dedupe_key, ':', 1)::uuid from public.agent_signals
     where kind = 'cook_rhythm' order by 1 $$,
  $$ values ('00000000-0000-0000-0000-624000000d01'::uuid),
            ('00000000-0000-0000-0000-624000000d05'::uuid),
            ('00000000-0000-0000-0000-624000000d06'::uuid) $$,
  'cook: on the threshold and on the 21-day floor fire; one day under, two cooks and a planned recipe do not'
);
select results_eq(
  $$ select dedupe_key = 'melk:' || ((now() at time zone 'Europe/Amsterdam')::date - 9)::text,
            payload->>'item_name', (payload->>'median_days')::numeric,
            (payload->>'days_since')::int, (payload->>'purchases')::int
     from public.agent_signals where kind = 'buy_rhythm' and dedupe_key like 'melk:%' $$,
  $$ values (true, 'Melk', 10.0, 9, 4) $$,
  'buy payload and dedupe_key carry the cycle'
);
select results_eq(
  $$ select payload->>'recipe_id', (payload->>'median_days')::numeric,
            (payload->>'days_since')::int, (payload->>'times')::int
     from public.agent_signals where kind = 'cook_rhythm'
       and dedupe_key like '00000000-0000-0000-0000-624000000d01:%' $$,
  $$ values ('00000000-0000-0000-0000-624000000d01', 30.0, 60, 3) $$,
  'cook payload carries the cycle'
);
select is(public.detect_rhythm_signals(), 0, 'a second run adds nothing (dedupe)');
select is((select count(*) from public.agent_signals where kind <> 'pattern'), 5::bigint,
  'still five rhythm signals');

select set_config('test.melk_id', (select id::text from public.agent_signals where dedupe_key like 'melk:%'), true);
select public.set_agent_signal_status(current_setting('test.melk_id')::uuid, 'dismissed');
select is(
  (select status from public.agent_signals where dedupe_key like 'melk:%'), 'dismissed',
  'new to dismissed is allowed');
select ok(
  (select status_changed_at > now() - interval '1 minute' from public.agent_signals where dedupe_key like 'melk:%'),
  'status_changed_at is set');
select throws_ok(
  format($$ select public.set_agent_signal_status(%L, 'acted') $$,
         (select id from public.agent_signals where dedupe_key like 'melk:%')),
  '22023', null, 'dismissed to acted is refused'
);
select throws_ok(
  format($$ select public.set_agent_signal_status(%L, 'skipped') $$,
         (select id from public.agent_signals where dedupe_key like 'rijst:%')),
  '22023', null, 'new to skipped is refused'
);
select throws_ok(
  format($$ select public.set_agent_signal_status(%L, 'new') $$,
         (select id from public.agent_signals where dedupe_key like 'rijst:%')),
  '22023', null, 'new to new is refused'
);
select lives_ok(
  format($$ select public.set_agent_signal_status(%L, 'acted') $$,
         (select id from public.agent_signals where dedupe_key like '00000000-0000-0000-0000-624000000d05:%')),
  'new to acted is allowed'
);

-- Resolving: rijst goes in the basket, R6 gets planned, R5 is cooked again.
reset role;
insert into public.shopping_list_items (user_id, name, position)
values ('00000000-0000-0000-0000-624000000a01', 'Rijst', 2000);
insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
values ('00000000-0000-0000-0000-624000000a01', current_setting('test.a_cal')::uuid,
        '00000000-0000-0000-0000-624000000d06', 2, 'dinner', current_date);
insert into public.activity_events (user_id, kind, occurred_at, recipe_id)
values ('00000000-0000-0000-0000-624000000a01', 'recipe_cooked', pg_temp.d(0),
        '00000000-0000-0000-0000-624000000d05');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000a01", "role": "authenticated"}';

select is(public.detect_rhythm_signals(), 0, 'resolving adds nothing');
select results_eq(
  $$ select split_part(dedupe_key, ':', 1), status from public.agent_signals
     where kind <> 'pattern' order by 1 $$,
  $$ values ('00000000-0000-0000-0000-624000000d01', 'new'),
            ('00000000-0000-0000-0000-624000000d05', 'acted'),
            ('melk', 'dismissed') $$,
  'open signals whose condition ended are deleted; dismissed and acted rows stay'
);
select results_eq(
  $$ select dedupe_key from public.agent_signals where kind = 'pattern' order by 1 $$,
  $$ values ('open'), ('recent') $$,
  'closed rows older than 180 days are pruned, younger ones and open patterns stay'
);

-- A foreign row is unreachable ----------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000b01", "role": "authenticated"}';
select throws_ok(
  format($$ select public.set_agent_signal_status(%L, 'dismissed') $$, current_setting('test.melk_id')),
  'P0002', null, 'B cannot change a signal of A'
);
select is((select count(*) from public.agent_signals), 1::bigint, 'B still sees only their own row');

-- Opting out of AI removes the pattern signals only ----------------------------------

reset role;
select is((select count(*) from public.agent_signals where user_id = '00000000-0000-0000-0000-624000000a01' and kind = 'pattern'),
  2::bigint, 'A has two pattern rows before opting out');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000a01", "role": "authenticated"}';
select public.set_ai_enabled(true);
select public.set_ai_enabled(false);
select is((select count(*) from public.agent_signals where kind = 'pattern'), 0::bigint,
  'set_ai_enabled(false) deletes the pattern signals');
select is((select count(*) from public.agent_signals where kind <> 'pattern'), 3::bigint,
  'rhythm signals stay');

-- service_role variant ------------------------------------------------------------------

reset role;
set local role service_role;
select is(public.detect_rhythm_signals_for('00000000-0000-0000-0000-624000000a01'), 0,
  'service_role can run the detector for one member');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-624000000a01", "role": "authenticated"}';
select throws_ok(
  $$ select public.detect_rhythm_signals_for('00000000-0000-0000-0000-624000000a01') $$,
  '42501', null, 'authenticated cannot call the _for variant'
);

select * from finish();
rollback;
