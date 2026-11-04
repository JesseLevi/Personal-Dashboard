-- assistant_pattern_traces (#757, ADR-0060 §3): owner-only read, no client writes,
-- the definer writer on auth.uid() with its consent check, the service_role-only
-- _for variant, the paused upsert (seen_count), paused -> asked with the signal
-- link, on delete set null, the 90-day delete in the detector run, and the wipe
-- when ai_enabled is turned off.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-757000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-757000000b01', 'b@test.local'),
       ('00000000-0000-0000-0000-757000000c01', 'c@test.local');

-- A and B consent; C does not.
update public.profiles set ai_enabled = true, ai_enabled_at = now()
where id in ('00000000-0000-0000-0000-757000000a01', '00000000-0000-0000-0000-757000000b01');

-- Fixtures written as the table owner: A has an old and a recent trace, B one.
insert into public.assistant_pattern_traces
  (user_id, dedupe_key, status, items, prompt_version, model, first_seen_at, last_seen_at)
values ('00000000-0000-0000-0000-757000000a01', 'old', 'paused', '[]', 'v1', 'm', now() - interval '100 days', now() - interval '91 days'),
       ('00000000-0000-0000-0000-757000000a01', 'recent', 'paused', '[]', 'v1', 'm', now() - interval '100 days', now() - interval '89 days'),
       ('00000000-0000-0000-0000-757000000b01', 'b-one', 'paused', '[]', 'v1', 'm', now(), now());

-- A signal of A that a trace can link to.
insert into public.agent_signals (id, user_id, kind, dedupe_key, payload, status)
values ('00000000-0000-0000-0000-757000000f01', '00000000-0000-0000-0000-757000000a01', 'pattern', 'cluster-1', '[]', 'skipped');

-- Grants -----------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.assistant_pattern_traces', 'SELECT')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_traces', 'INSERT')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_traces', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.assistant_pattern_traces', 'DELETE')
  and not has_table_privilege('anon', 'public.assistant_pattern_traces', 'SELECT'),
  'authenticated may only select; anon has nothing'
);

select ok(
  has_function_privilege('authenticated',
    'public.record_assistant_pattern_trace(text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE')
  and not has_function_privilege('anon',
    'public.record_assistant_pattern_trace(text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE'),
  'the member writer is executable by authenticated, never by anon'
);

select ok(
  has_function_privilege('service_role',
    'public.record_assistant_pattern_trace_for(uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE')
  and not has_function_privilege('authenticated',
    'public.record_assistant_pattern_trace_for(uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE')
  and not has_function_privilege('anon',
    'public.record_assistant_pattern_trace_for(uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE'),
  'the _for variant is executable by service_role only'
);

select ok(
  not has_function_privilege('authenticated',
    'private.record_assistant_pattern_trace(uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer)',
    'EXECUTE'),
  'the private writer is not executable by authenticated'
);

-- Member A ---------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-757000000a01", "role": "authenticated"}';

select is(
  (select count(*)::int from public.assistant_pattern_traces),
  2,
  'A sees only own rows'
);
select is_empty(
  $$ select 1 from public.assistant_pattern_traces where user_id = '00000000-0000-0000-0000-757000000b01' $$,
  'A cannot see the traces of B'
);
select throws_ok(
  $$ insert into public.assistant_pattern_traces (user_id, dedupe_key, status, prompt_version, model)
     values ('00000000-0000-0000-0000-757000000a01', 'x', 'paused', 'v1', 'm') $$,
  '42501', null, 'A cannot insert directly'
);
select throws_ok(
  $$ update public.assistant_pattern_traces set status = 'asked' $$,
  '42501', null, 'A cannot update'
);
select throws_ok(
  $$ delete from public.assistant_pattern_traces $$,
  '42501', null, 'A cannot delete'
);
select throws_ok(
  $$ select public.record_assistant_pattern_trace_for('00000000-0000-0000-0000-757000000a01',
       'paused', 'x', '[]'::jsonb, '[]'::jsonb, 'v1', 'm', null, 0, 0, 0) $$,
  '42501', null, 'authenticated cannot call the _for variant'
);

-- A paused cluster is written once; seeing it again bumps the counters --------

select is(
  public.record_assistant_pattern_trace(
    'paused', 'cluster-1', '[{"type":"note","id":"n1","kind":"note","title":"T","fragment":"F","stale":false}]'::jsonb,
    '[{"a":0,"b":1,"similarity":0.9}]'::jsonb, 'v1', 'm', null, 0, 0, 0),
  true,
  'A records a paused trace through the definer function'
);
select results_eq(
  $$ select status, seen_count, signal_id is null, items -> 0 ->> 'title'
     from public.assistant_pattern_traces where dedupe_key = 'cluster-1' $$,
  $$ values ('paused'::text, 1, true, 'T'::text) $$,
  'the paused trace carries the items and no signal'
);
select public.record_assistant_pattern_trace(
  'paused', 'cluster-1', '[]'::jsonb, '[]'::jsonb, 'v1', 'm', null, 0, 0, 0);
select results_eq(
  $$ select count(*)::int, max(seen_count) from public.assistant_pattern_traces where dedupe_key = 'cluster-1' $$,
  $$ values (1, 2) $$,
  'seen again: one row, seen_count 2'
);
select ok(
  (select last_seen_at > first_seen_at and items -> 0 ->> 'title' = 'T'
   from public.assistant_pattern_traces where dedupe_key = 'cluster-1'),
  'seen again bumps last_seen_at and keeps the first items'
);

-- Later asked: becomes asked, keeps the answer, links the signal ---------------

select public.record_assistant_pattern_trace(
  'asked', 'cluster-1', '[{"type":"note","id":"n1","kind":"note","title":"T","fragment":"F","stale":false}]'::jsonb,
  '[]'::jsonb, 'v2', 'm2',
  '{"helpful": true, "message_raw": "Raw", "message": "Clean", "rejected": null}'::jsonb, 120, 30, 800);
select results_eq(
  $$ select status, seen_count, prompt_version, input_tokens, output_tokens, duration_ms,
            answer ->> 'message', signal_id
     from public.assistant_pattern_traces where dedupe_key = 'cluster-1' $$,
  $$ values ('asked'::text, 3, 'v2'::text, 120, 30, 800, 'Clean'::text,
             '00000000-0000-0000-0000-757000000f01'::uuid) $$,
  'paused later asked: status asked, answer kept, linked to its signal'
);
select public.record_assistant_pattern_trace(
  'paused', 'cluster-1', '[]'::jsonb, '[]'::jsonb, 'v3', 'm3', null, 0, 0, 0);
select results_eq(
  $$ select status, prompt_version, answer ->> 'message' from public.assistant_pattern_traces where dedupe_key = 'cluster-1' $$,
  $$ values ('asked'::text, 'v2'::text, 'Clean'::text) $$,
  'a later paused sighting never downgrades an asked trace'
);
select throws_ok(
  $$ select public.record_assistant_pattern_trace(
       'nonsense', 'y', '[]'::jsonb, '[]'::jsonb, 'v1', 'm', null, 0, 0, 0) $$,
  '23514', null, 'an unknown status is rejected'
);

-- The detector run deletes traces 90 days after last_seen_at.
select public.detect_rhythm_signals();
select is(
  (select count(*)::int from public.assistant_pattern_traces where dedupe_key = 'old'),
  0,
  'the detector run deletes traces last seen over 90 days ago'
);
select is(
  (select count(*)::int from public.assistant_pattern_traces where dedupe_key in ('recent', 'cluster-1')),
  2,
  'recent traces survive the cleanup'
);

-- Member C: no consent, no row ---------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-757000000c01", "role": "authenticated"}';

select is(
  public.record_assistant_pattern_trace(
    'paused', 'z', '[]'::jsonb, '[]'::jsonb, 'v1', 'm', null, 0, 0, 0),
  false,
  'C has no opt-in: nothing is written'
);
select is(
  (select count(*)::int from public.assistant_pattern_traces),
  0,
  'C sees no rows'
);

-- service_role writes for a member -------------------------------------------

reset role;
set local role service_role;

select is(
  public.record_assistant_pattern_trace_for('00000000-0000-0000-0000-757000000b01',
    'paused', 'b-two', '[]'::jsonb, '[]'::jsonb, 'v1', 'm', null, 0, 0, 0),
  true,
  'service_role records a trace for B'
);

-- Deleting the signal keeps the trace and nulls the link -----------------------

reset role;
delete from public.agent_signals where id = '00000000-0000-0000-0000-757000000f01';
select results_eq(
  $$ select count(*)::int, count(signal_id)::int from public.assistant_pattern_traces where dedupe_key = 'cluster-1' $$,
  $$ values (1, 0) $$,
  'deleting the signal keeps the trace and sets signal_id to null'
);

-- Opt-in off wipes the member's traces, only theirs ----------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-757000000a01", "role": "authenticated"}';
select public.set_ai_enabled(false);
select is(
  (select count(*)::int from public.assistant_pattern_traces),
  0,
  'turning ai_enabled off wipes the traces of A'
);
reset role;
select is(
  (select count(*)::int from public.assistant_pattern_traces where user_id = '00000000-0000-0000-0000-757000000a01'),
  0,
  'no trace of A is left'
);
select is(
  (select count(*)::int from public.assistant_pattern_traces where user_id = '00000000-0000-0000-0000-757000000b01'),
  2,
  'the traces of B are untouched'
);

-- Account deletion cascades -----------------------------------------------------

delete from auth.users where id = '00000000-0000-0000-0000-757000000b01';
select is(
  (select count(*)::int from public.assistant_pattern_traces),
  0,
  'deleting the account removes its traces'
);

select * from finish();
rollback;
