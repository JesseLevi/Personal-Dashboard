-- Assistent pattern step (#628, ADR-0046 §3-5): neighbour edges, the
-- reserve/complete pair (consent, ownership, dedupe, 3 calls per day), the
-- service_role-only variants, the opt-out delete and the cron member ordering.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-628000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-628000000b01', 'b@test.local'),
       ('00000000-0000-0000-0000-628000000c01', 'c@test.local');

-- A consents; B has the same kind of data but did not; C only owns a note.
update public.profiles set ai_enabled = true, ai_enabled_at = now()
where id = '00000000-0000-0000-0000-628000000a01';

select set_config('test.v1', '[1' || repeat(',0', 1023) || ']', true);
select set_config('test.v2', '[1,0.1' || repeat(',0', 1022) || ']', true);
select set_config('test.v3', '[1,0,0.1' || repeat(',0', 1021) || ']', true);
select set_config('test.far', '[0,0,0,1' || repeat(',0', 1020) || ']', true);

insert into public.notes (id, user_id, category_id, title, content_text, position, updated_at)
select v.id::uuid, v.uid::uuid,
       (select id from public.note_categories where user_id = v.uid::uuid limit 1),
       v.title, v.body, 1000, v.upd::timestamptz
from (values
  ('00000000-0000-0000-0000-628000000a11', '00000000-0000-0000-0000-628000000a01', 'A1', 'koffie', now()::text),
  ('00000000-0000-0000-0000-628000000a12', '00000000-0000-0000-0000-628000000a01', 'A2', 'koffie bonen', now()::text),
  ('00000000-0000-0000-0000-628000000a13', '00000000-0000-0000-0000-628000000a01', 'A3', 'koffie machine', now()::text),
  ('00000000-0000-0000-0000-628000000a14', '00000000-0000-0000-0000-628000000a01', 'A4', 'iets heel anders', now()::text),
  ('00000000-0000-0000-0000-628000000a15', '00000000-0000-0000-0000-628000000a01', 'A5 oud', 'koffie oud', (now() - interval '40 days')::text),
  ('00000000-0000-0000-0000-628000000b11', '00000000-0000-0000-0000-628000000b01', 'B1', 'koffie', now()::text),
  ('00000000-0000-0000-0000-628000000b12', '00000000-0000-0000-0000-628000000b01', 'B2', 'koffie bonen', now()::text),
  ('00000000-0000-0000-0000-628000000c11', '00000000-0000-0000-0000-628000000c01', 'C1', 'geheim', now()::text)
) as v(id, uid, title, body, upd);

insert into public.embeddings (user_id, note_id, chunk_index, content_text, content_hash, source_updated_at, model, embedding)
select v.uid::uuid, v.id::uuid, 0, 'x', 'h-' || v.id, now(), 'm', current_setting(v.vec)::extensions.halfvec
from (values
  ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000a11', 'test.v1'),
  ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000a12', 'test.v2'),
  ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000a13', 'test.v3'),
  ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000a14', 'test.far'),
  ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000a15', 'test.v1'),
  ('00000000-0000-0000-0000-628000000b01', '00000000-0000-0000-0000-628000000b11', 'test.v1'),
  ('00000000-0000-0000-0000-628000000b01', '00000000-0000-0000-0000-628000000b12', 'test.v2')
) as v(uid, id, vec);

-- A pattern row from two days ago: it must not count toward today's budget.
insert into public.agent_signals (user_id, kind, dedupe_key, payload, message, status, created_at)
values ('00000000-0000-0000-0000-628000000a01', 'pattern', 'yesterday', '{}', 'oud', 'dismissed', now() - interval '2 days');

-- Grants -----------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.pattern_edges()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reserve_pattern_signal(text, jsonb, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.complete_pattern_signal(text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pattern_edges()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reserve_pattern_signal(text, jsonb, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_pattern_signal(text, text)', 'EXECUTE'),
  'the member-facing pattern functions are executable by authenticated, never by anon'
);
select ok(
  has_function_privilege('service_role', 'public.pattern_edges_for(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.reserve_pattern_signal_for(uuid, text, jsonb, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_pattern_signal_for(uuid, text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.assistant_members_by_last_run()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pattern_edges_for(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.reserve_pattern_signal_for(uuid, text, jsonb, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_pattern_signal_for(uuid, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.assistant_members_by_last_run()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.assistant_members_by_last_run()', 'EXECUTE'),
  'the _for variants and the member ordering are executable by service_role only'
);
select ok(
  not has_function_privilege('authenticated', 'private.reserve_pattern_signal(uuid, text, jsonb, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.complete_pattern_signal(uuid, text, text)', 'EXECUTE'),
  'the private writers are not executable by authenticated'
);

-- Edges ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-628000000a01", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pattern_edges()),
  9,
  'A: six edges among the three coffee notes plus three to the old note'
);
select is_empty(
  $$ select 1 from public.pattern_edges() where a_id = '00000000-0000-0000-0000-628000000a14' or b_id = '00000000-0000-0000-0000-628000000a14' $$,
  'A: the unrelated note has no edge'
);
select is_empty(
  $$ select 1 from public.pattern_edges() where a_id = '00000000-0000-0000-0000-628000000a15' $$,
  'A: a note not changed within 30 days is never a seed'
);
select ok(
  (select bool_and(similarity >= 0.8) from public.pattern_edges()),
  'A: every edge is at least 0.80 similar'
);
select is(
  (select count(*)::int from public.pattern_edges()
   where a_id = '00000000-0000-0000-0000-628000000c11' or b_id = '00000000-0000-0000-0000-628000000c11'),
  0,
  'A: no edge reaches another member''s note'
);
select throws_ok(
  $$ select * from public.pattern_edges_for('00000000-0000-0000-0000-628000000a01') $$,
  '42501', null, 'authenticated cannot call pattern_edges_for'
);

-- Reserve ----------------------------------------------------------------

select is(
  public.reserve_pattern_signal('k1',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb,
    'nl'),
  'reserved',
  'A: a valid cluster is reserved'
);
select results_eq(
  $$ select status, message, locale, jsonb_array_length(payload -> 'sources') from public.agent_signals where dedupe_key = 'k1' $$,
  $$ values ('skipped'::text, null::text, 'nl'::text, 3) $$,
  'the reservation is a skipped row with the SQL-given sources and the locale'
);
select is(
  public.reserve_pattern_signal('k1',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb,
    'nl'),
  'exists',
  'a known dedupe_key is reported as existing'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"}]'::jsonb, 'nl'),
  'invalid',
  'fewer than three sources is invalid'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000c11"}]'::jsonb, 'nl'),
  'invalid',
  'a source owned by someone else is invalid'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"recipe","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb, 'nl'),
  'invalid',
  'a source type other than note or card is invalid'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"}]'::jsonb, 'nl'),
  'invalid',
  'a duplicated source is invalid'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"niet-een-uuid"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb, 'nl'),
  'invalid',
  'a malformed id is invalid, not an error'
);
select is(
  public.reserve_pattern_signal('kx',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb, 'fr'),
  'invalid',
  'an unknown locale is invalid'
);

-- Budget: 'yesterday' does not count, k1 does; two more fit, the fourth does not.
select is(
  public.reserve_pattern_signal('k2',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a14"}]'::jsonb, 'en'),
  'reserved',
  'the second call of the day is reserved (a row from two days ago does not count)'
);
select is(
  public.reserve_pattern_signal('k3',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"},{"type":"note","id":"00000000-0000-0000-0000-628000000a14"}]'::jsonb, 'nl'),
  'reserved',
  'the third call of the day is reserved'
);
select is(
  public.reserve_pattern_signal('k4',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"},{"type":"note","id":"00000000-0000-0000-0000-628000000a14"}]'::jsonb, 'nl'),
  'budget',
  'the fourth call of the day is refused'
);
select is(
  public.reserve_pattern_signal('k1',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a11"},{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"}]'::jsonb,
    'nl'),
  'exists',
  'a known cluster is still reported as existing when the budget is spent'
);

-- Complete ---------------------------------------------------------------

select ok(public.complete_pattern_signal('k1', '  Je schrijft vaak over koffie.  '), 'a reserved row is completed');
select results_eq(
  $$ select status, message from public.agent_signals where dedupe_key = 'k1' $$,
  $$ values ('new'::text, 'Je schrijft vaak over koffie.'::text) $$,
  'the row is now a new signal with the trimmed message'
);
select ok(not public.complete_pattern_signal('k1', 'tweede keer'), 'a completed row cannot be rewritten');
select ok(not public.complete_pattern_signal('k2', repeat('x', 281)), 'a message over 280 characters is refused');
select ok(not public.complete_pattern_signal('k2', '   '), 'an empty message is refused');
select ok(not public.complete_pattern_signal('bestaat-niet', 'hallo'), 'an unknown key completes nothing');
select ok(not public.complete_pattern_signal('yesterday', 'hallo'), 'a row with a message already cannot be completed');
select throws_ok(
  $$ select public.reserve_pattern_signal_for('00000000-0000-0000-0000-628000000a01', 'kz', '[]'::jsonb, 'nl') $$,
  '42501', null, 'authenticated cannot call reserve_pattern_signal_for'
);

-- Another member ------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-628000000b01", "role": "authenticated"}';

select is_empty($$ select 1 from public.pattern_edges() $$, 'B: no edges without consent');
select is(
  public.reserve_pattern_signal('kb',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000b11"},{"type":"note","id":"00000000-0000-0000-0000-628000000b12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a11"}]'::jsonb, 'nl'),
  'invalid',
  'B: A''s note as a source is invalid'
);
select ok(not public.complete_pattern_signal('k2', 'van B'), 'B cannot complete A''s reservation');

-- service_role -----------------------------------------------------------------

reset role;
set local role service_role;

select is(
  public.reserve_pattern_signal_for('00000000-0000-0000-0000-628000000a01', 'k5',
    '[{"type":"note","id":"00000000-0000-0000-0000-628000000a12"},{"type":"note","id":"00000000-0000-0000-0000-628000000a13"},{"type":"note","id":"00000000-0000-0000-0000-628000000a14"}]'::jsonb, 'nl'),
  'budget',
  'service_role: the cron path counts against the same daily budget'
);
select ok(
  public.complete_pattern_signal_for('00000000-0000-0000-0000-628000000a01', 'k2', 'Via de cron.'),
  'service_role: completes a reserved row for a member'
);

reset role;
insert into private.assistant_runs (user_id, last_run_at)
values ('00000000-0000-0000-0000-628000000a01', now()),
       ('00000000-0000-0000-0000-628000000b01', now() - interval '1 day');

set local role service_role;
select is(
  (select array_agg(m.user_id order by m.n)
   from public.assistant_members_by_last_run() with ordinality as m(user_id, n)
   where m.user_id in ('00000000-0000-0000-0000-628000000a01', '00000000-0000-0000-0000-628000000b01',
                       '00000000-0000-0000-0000-628000000c01')),
  array['00000000-0000-0000-0000-628000000c01', '00000000-0000-0000-0000-628000000b01',
        '00000000-0000-0000-0000-628000000a01']::uuid[],
  'members are ordered never-run first, then oldest run first'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-628000000a01", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.assistant_members_by_last_run() $$,
  '42501', null, 'authenticated cannot read the member ordering'
);

-- Opting out ---------------------------------------------------------------------

select lives_ok($$ select public.set_ai_enabled(false) $$, 'A can switch the opt-in off');
select is(
  (select count(*)::int from public.agent_signals where kind = 'pattern'),
  0,
  'switching off deletes every pattern signal, closed ones included'
);

select * from finish();
rollback;
