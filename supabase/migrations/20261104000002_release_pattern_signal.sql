-- release_pattern_signal (#771, ADR-0060 "Failed calls"): gives back the
-- reservation of a pattern call that Anthropic did not bill (HTTP error
-- response), so it neither costs a budget slot nor hides the cluster.
--
-- It only deletes the member's own still-reserved row: kind 'pattern', status
-- 'skipped', no message, created in the last 5 minutes. A client therefore
-- cannot win budget back from an answered (not helpful) call: those rows are
-- the same shape, but the window keeps the gain to one failed call at a time.
-- Returns true when a row was deleted.

create function private.release_pattern_signal(p_user uuid, p_dedupe_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_user is null or p_dedupe_key is null then
    return false;
  end if;

  -- Same lock as reserve_pattern_signal: serialises against the budget count.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assistant_pattern:' || p_user::text, 0));

  delete from public.agent_signals s
  where s.user_id = p_user and s.kind = 'pattern' and s.dedupe_key = p_dedupe_key
    and s.status = 'skipped' and s.message is null
    and s.created_at >= pg_catalog.now() - interval '5 minutes';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.release_pattern_signal(p_dedupe_key text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then false
              else private.release_pattern_signal((select auth.uid()), p_dedupe_key) end
$$;

create function public.release_pattern_signal_for(p_user uuid, p_dedupe_key text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.release_pattern_signal(p_user, p_dedupe_key)
$$;

comment on function public.release_pattern_signal is
  'Deletes the caller''s own reserved pattern row (skipped, no message, at most 5 minutes old) after a call that was not billed (ADR-0060).';
comment on function public.release_pattern_signal_for is
  'Same for one member, for the cron route. service_role only.';

revoke execute on function private.release_pattern_signal(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_pattern_signal(text) from public, anon;
grant execute on function public.release_pattern_signal(text) to authenticated;
revoke execute on function public.release_pattern_signal_for(uuid, text) from public, anon, authenticated;
grant execute on function public.release_pattern_signal_for(uuid, text) to service_role;
