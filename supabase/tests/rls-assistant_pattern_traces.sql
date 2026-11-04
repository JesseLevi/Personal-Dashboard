-- assistant_pattern_traces (#757, ADR-0060 §3): owner-only read, no client writes,
-- the definer writer on auth.uid() with its consent check, the service_role-only
-- _for variant, the upsert (a paused cluster seen again, a paused trace later
-- asked), the 90-day prune in the detector run, the wipe on opt-out, the
-- set-null on a deleted signal and the cascade on account delete.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-757000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-757000000b01', 'b@test.local'),
       ('00000000-0000-0000-0000-757000000c01', 'c@test.local');

-- A and B consent; C does not.
update public.profiles set ai_enabled = true, ai_enabled_at = now()
where id in ('00000000-0000-0000-0000-757000000a01', '00000000-0000-0000-0000-757000000b01');

-- Fixtures written as the table owner: A has an old and a recent trace, B one,
-- and A has the pattern signal that the 'k1' trace gets linked to.
insert into public.agent_signals (id, user_id, kind, dedupe_key, payload, message)
values ('00000000-0000-0000-0000-757000000f01', '00000000-0000-0000-0000-757000000a01',
        'pattern', 'k1', '{"sources": []}', 'Een patroon');

insert into public.assistant_pattern_traces (user_id, dedupe_key, status, last_seen_at, first_seen_at)
values ('00000000-0000-0000-0000-757000000a01', 'old', 'paused', now() - interval '100 days', now() - interval '120 days'),
       ('00000000-0000-0000-0000-757000000a01', 'recent', 'paused', now() - interval '1 day', now() - interval '1 day'),
       ('00000000-0000-0000-0000-757000000b01', 'b1', 'paused', now() - interval '1 day', now() - interval '1 day');

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
  'A cannot see the rows of B'
);
select throws_ok(
  $$ insert into public.assistant_pattern_traces (user_id, dedupe_key, status)
     values ('00000000-0000-0000-0000-757000000a01', 'x', 'paused') $$,
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

-- A paused cluster: written once, then seen again.
select is(
  public.record_assistant_pattern_trace(
    'k0', 'paused',
    '[{"type": "note", "id": "n1", "kind": "note", "title": "Titel", "fragment": "Tekst", "stale": false}]'::jsonb,
    '[{"a": "note:n1", "b": "note:n2", "similarity": 0.91}]'::jsonb,
    'abc', 'model-x', null, null, null, null),
  true,
  'A records a paused trace through the definer function'
);
select results_eq(
  $$ select status, seen_count, signal_id is null, answer is null, items -> 0 ->> 'title'
     from public.assistant_pattern_traces where dedupe_key = 'k0' $$,
  $$ values ('paused'::text, 1, true, true, 'Titel'::text) $$,
  'the paused trace carries the items and has no answer or signal'
);
select is(
  public.record_assistant_pattern_trace(
    'k0', 'paused', '[]'::jsonb, '[]'::jsonb, 'abc', 'model-x', null, null, null, null),
  true,
  'the same paused cluster seen again is accepted'
);
select results_eq(
  $$ select count(*)::int, max(seen_count), max(items -> 0 ->> 'title') is null
     from public.assistant_pattern_traces where dedupe_key = 'k0' $$,
  $$ values (1, 2, true) $$,
  'seen_count is 2 with no extra row, and a paused trace takes the fresh items'
);

-- A paused trace later asked becomes asked, keeps the answer and links the signal.
select public.record_assistant_pattern_trace(
  'k1', 'paused', '[{"title": "Eerst"}]'::jsonb, '[]'::jsonb, 'abc', 'model-x', null, null, null, null);
select is(
  public.record_assistant_pattern_trace(
    'k1', 'asked', '[{"title": "Gevraagd"}]'::jsonb, '[]'::jsonb, 'abc', 'model-x',
    '{"helpful": true, "message_raw": "Een patroon", "message": "Een patroon", "rejected": null}'::jsonb,
    120, 30, 800),
  true,
  'asking a paused cluster is accepted'
);
select results_eq(
  $$ select status, seen_count, answer ->> 'message', input_tokens, output_tokens, duration_ms,
            signal_id = '00000000-0000-0000-0000-757000000f01'::uuid, items -> 0 ->> 'title'
     from public.assistant_pattern_traces where dedupe_key = 'k1' $$,
  $$ values ('asked'::text, 2, 'Een patroon'::text, 120, 30, 800, true, 'Gevraagd'::text) $$,
  'the trace is asked, with the answer, the tokens and its signal'
);

-- Seen paused again after it was asked: it stays asked and keeps its answer.
select public.record_assistant_pattern_trace(
  'k1', 'paused', '[]'::jsonb, '[]'::jsonb, 'abc', 'model-x', null, null, null, null);
select results_eq(
  $$ select status, seen_count, answer ->> 'message', items -> 0 ->> 'title'
     from public.assistant_pattern_traces where dedupe_key = 'k1' $$,
  $$ values ('asked'::text, 3, 'Een patroon'::text, 'Gevraagd'::text) $$,
  'a paused sighting never downgrades an asked trace'
);

select throws_ok(
  $$ select public.record_assistant_pattern_trace(
       'k2', 'nonsense', '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, null) $$,
  '23514', null, 'an unknown status is rejected'
);
select throws_ok(
  $$ select public.record_assistant_pattern_trace_for('00000000-0000-0000-0000-757000000a01',
       'k2', 'paused', '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, null) $$,
  '42501', null, 'authenticated cannot call the _for variant'
);

-- The detector run prunes traces 90 days after last_seen_at.
select public.detect_rhythm_signals();
select is(
  (select count(*)::int from public.assistant_pattern_traces where last_seen_at < now() - interval '90 days'),
  0,
  'the detector run prunes traces older than 90 days'
);
select is(
  (select count(*)::int from public.assistant_pattern_traces where dedupe_key = 'recent'),
  1,
  'recent traces survive the prune'
);

-- Member C: no consent, no row ---------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-757000000c01", "role": "authenticated"}';

select is(
  public.record_assistant_pattern_trace(
    'kc', 'paused', '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, null),
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
    'b2', 'paused', '[]'::jsonb, '[]'::jsonb, 'abc', 'model-x', null, null, null, null),
  true,
  'service_role records a trace for B'
);

-- A deleted signal leaves the trace with a null signal_id -----------------------

reset role;

delete from public.agent_signals where id = '00000000-0000-0000-0000-757000000f01';
select is(
  (select count(*)::int from public.assistant_pattern_traces
   where dedupe_key = 'k1' and signal_id is null and status = 'asked'),
  1,
  'deleting the signal keeps the trace and nulls signal_id'
);

-- Opt-out wipes the member's traces, not those of others -----------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-757000000a01", "role": "authenticated"}';
select public.set_ai_enabled(false);
select is(
  (select count(*)::int from public.assistant_pattern_traces),
  0,
  'turning the opt-in off removes all of A''s traces'
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
  (select count(*)::int from public.assistant_pattern_traces where user_id = '00000000-0000-0000-0000-757000000b01'),
  0,
  'deleting the account removes its traces'
);

select * from finish();
rollback;
