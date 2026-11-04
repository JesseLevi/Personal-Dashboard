-- assistant_pattern_runs (#756, ADR-0060 §2): owner-only read, no client writes,
-- the definer writer on auth.uid() with its consent check, the service_role-only
-- _for variant, the 180-day prune in the detector run, and the operator view.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-756000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-756000000b01', 'b@test.local'),
       ('00000000-0000-0000-0000-756000000c01', 'c@test.local');

-- A and B consent; C does not.
update public.profiles set ai_enabled = true, ai_enabled_at = now()
where id in ('00000000-0000-0000-0000-756000000a01', '00000000-0000-0000-0000-756000000b01');

-- Fixtures written as the table owner: A has an old and a recent run, B one.
insert into public.assistant_pattern_runs (user_id, path, started_at, duration_ms, outcome, edges, similarity_bands)
values ('00000000-0000-0000-0000-756000000a01', 'cron', now() - interval '200 days', 10, 'ok', 4, '{"0.80": 4}'),
       ('00000000-0000-0000-0000-756000000a01', 'lazy', now() - interval '1 day', 12, 'no_clusters', 2, '{"0.80": 2}'),
       ('00000000-0000-0000-0000-756000000b01', 'lazy', now() - interval '1 day', 14, 'no_edges', 0, '{}');

-- Grants -----------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.assistant_pattern_runs', 'SELECT')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_runs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_runs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_runs', 'DELETE')
  and not has_table_privilege('anon', 'public.assistant_pattern_runs', 'SELECT'),
  'authenticated may only select; anon has nothing'
);

select ok(
  has_function_privilege('authenticated',
    'public.record_assistant_pattern_run(text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE')
  and not has_function_privilege('anon',
    'public.record_assistant_pattern_run(text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE'),
  'the member writer is executable by authenticated, never by anon'
);

select ok(
  has_function_privilege('service_role',
    'public.record_assistant_pattern_run_for(uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE')
  and not has_function_privilege('authenticated',
    'public.record_assistant_pattern_run_for(uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE')
  and not has_function_privilege('anon',
    'public.record_assistant_pattern_run_for(uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE'),
  'the _for variant is executable by service_role only'
);

select ok(
  not has_function_privilege('authenticated',
    'private.record_assistant_pattern_run(uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb)',
    'EXECUTE'),
  'the private writer is not executable by authenticated'
);

select ok(
  not has_table_privilege('authenticated', 'private.assistant_pattern_daily', 'SELECT')
  and not has_table_privilege('anon', 'private.assistant_pattern_daily', 'SELECT')
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'assistant_pattern_daily' and column_name = 'user_id'
  ),
  'the operator view has no user_id and no client grant'
);

-- Member A ---------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-756000000a01", "role": "authenticated"}';

select is(
  (select count(*)::int from public.assistant_pattern_runs),
  2,
  'A sees only own rows'
);
select is_empty(
  $$ select 1 from public.assistant_pattern_runs where user_id = '00000000-0000-0000-0000-756000000b01' $$,
  'A cannot see the rows of B'
);
select throws_ok(
  $$ insert into public.assistant_pattern_runs (user_id, path, started_at, duration_ms, outcome)
     values ('00000000-0000-0000-0000-756000000a01', 'lazy', now(), 1, 'ok') $$,
  '42501', null, 'A cannot insert directly'
);
select throws_ok(
  $$ update public.assistant_pattern_runs set outcome = 'ok' $$,
  '42501', null, 'A cannot update'
);
select throws_ok(
  $$ delete from public.assistant_pattern_runs $$,
  '42501', null, 'A cannot delete'
);

select is(
  public.record_assistant_pattern_run(
    'lazy', now(), 25, 'paused', null,
    9, '{"0.80": 5, "0.85": 4}'::jsonb, 2, '{"3": 2}'::jsonb,
    0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
    '{"model": "m", "prompt_version": "abc"}'::jsonb),
  true,
  'A records a paused run through the definer function'
);
select results_eq(
  $$ select outcome, candidates, calls, edges, config ->> 'prompt_version'
     from public.assistant_pattern_runs where outcome = 'paused' $$,
  $$ values ('paused'::text, 2, 0, 9, 'abc'::text) $$,
  'the row carries the counts and the config'
);
select throws_ok(
  $$ select public.record_assistant_pattern_run(
       'lazy', now(), 1, 'nonsense', null, 0, '{}'::jsonb, 0, '{}'::jsonb,
       0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb) $$,
  '23514', null, 'an unknown outcome is rejected'
);
select throws_ok(
  $$ select public.record_assistant_pattern_run_for('00000000-0000-0000-0000-756000000a01',
       'lazy', now(), 1, 'ok', null, 0, '{}'::jsonb, 0, '{}'::jsonb,
       0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb) $$,
  '42501', null, 'authenticated cannot call the _for variant'
);

-- The detector run prunes rows older than 180 days.
select public.detect_rhythm_signals();
select is(
  (select count(*)::int from public.assistant_pattern_runs where started_at < now() - interval '180 days'),
  0,
  'the detector run prunes runs older than 180 days'
);
select is(
  (select count(*)::int from public.assistant_pattern_runs),
  2,
  'recent runs survive the prune'
);

-- Member C: no consent, no row ---------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-756000000c01", "role": "authenticated"}';

select is(
  public.record_assistant_pattern_run(
    'lazy', now(), 5, 'no_edges', null, 0, '{}'::jsonb, 0, '{}'::jsonb,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb),
  false,
  'C has no opt-in: nothing is written'
);
select is(
  (select count(*)::int from public.assistant_pattern_runs),
  0,
  'C sees no rows'
);

-- service_role writes for a member -------------------------------------------

reset role;
set local role service_role;

select is(
  public.record_assistant_pattern_run_for('00000000-0000-0000-0000-756000000b01',
    'cron', now(), 7, 'budget', null, 12, '{"0.90": 12}'::jsonb, 1, '{"3": 1}'::jsonb,
    0, 0, 1, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb),
  true,
  'service_role records a run for B'
);

-- Operator view ----------------------------------------------------------------

reset role;

select results_eq(
  $$ select runs, paused_runs, budget_runs, no_edges_runs, band_090 from private.assistant_pattern_daily
     where day = (now() at time zone 'Europe/Amsterdam')::date $$,
  $$ values (2, 1, 1, 0, 12) $$,
  'the view sums per day over members'
);

select * from finish();
rollback;
