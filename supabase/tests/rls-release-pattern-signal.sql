-- release_pattern_signal (#771, ADR-0060 "Failed calls"): a member can give back
-- only their own fresh, unanswered reservation; the _for variant is service_role only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-771000000a01', 'a@test.local'),
       ('00000000-0000-0000-0000-771000000b01', 'b@test.local');

insert into public.agent_signals (user_id, kind, dedupe_key, payload, message, status, created_at)
values
  ('00000000-0000-0000-0000-771000000a01', 'pattern', 'fresh', '{}', null, 'skipped', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-771000000a01', 'pattern', 'old', '{}', null, 'skipped', now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-771000000a01', 'pattern', 'with-message', '{}', 'tekst', 'skipped', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-771000000a01', 'pattern', 'answered', '{}', 'tekst', 'new', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-771000000a01', 'buy_rhythm', 'rhythm', '{}', null, 'skipped', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-771000000a01', 'pattern', 'fresh-for', '{}', null, 'skipped', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-771000000b01', 'pattern', 'b-fresh', '{}', null, 'skipped', now() - interval '1 minute');

select ok(
  has_function_privilege('authenticated', 'public.release_pattern_signal(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.release_pattern_signal(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.release_pattern_signal_for(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.release_pattern_signal_for(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.release_pattern_signal_for(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.release_pattern_signal(uuid, text)', 'EXECUTE'),
  'release is executable by authenticated, the _for variant by service_role only, the private one by nobody'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-771000000a01", "role": "authenticated"}';

select is(public.release_pattern_signal('fresh'), true, 'A: a fresh, unanswered reservation is released');
select is_empty(
  $$ select 1 from public.agent_signals where dedupe_key = 'fresh' $$,
  'A: the released row is gone'
);
select is(public.release_pattern_signal('old'), false, 'A: a reservation older than 5 minutes is not released');
select is(public.release_pattern_signal('with-message'), false, 'A: a row with a message is not released');
select is(public.release_pattern_signal('answered'), false, 'A: an answered signal is not released');
select is(public.release_pattern_signal('rhythm'), false, 'A: a row of another kind is not released');
select is(public.release_pattern_signal('b-fresh'), false, 'A: another member''s row is not released');
select throws_ok(
  $$ select public.release_pattern_signal_for('00000000-0000-0000-0000-771000000a01', 'fresh-for') $$,
  '42501', null, 'authenticated cannot call release_pattern_signal_for'
);

reset role;
set local role service_role;
select is(
  public.release_pattern_signal_for('00000000-0000-0000-0000-771000000a01', 'fresh-for'),
  true,
  'service_role releases a fresh reservation for one member'
);

select * from finish();
rollback;
