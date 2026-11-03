-- #755 (ADR-0060 §1): pause the pattern step without stopping collection.
-- profiles.assistant_patterns_enabled (default true) is subordinate to
-- ai_enabled; set_assistant_patterns_enabled() is its only writer, and the
-- reserve function returns 'paused' when it is off. Additive.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

alter table public.profiles
  add column assistant_patterns_enabled boolean not null default true;

comment on column public.profiles.assistant_patterns_enabled is
  'Pause for the Assistent pattern step (ADR-0060 §1). Off = no Haiku call and no pattern row; embeddings, rhythms and the log continue. Consent stays ai_enabled. Written only through set_assistant_patterns_enabled().';

-- No column grant on purpose: the column grants on profiles list the writable
-- columns, so this one is writable only through the definer function below.

create function public.set_assistant_patterns_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'p_enabled must not be null' using errcode = '22004';
  end if;

  update public.profiles
  set assistant_patterns_enabled = p_enabled
  where id = v_uid;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.set_assistant_patterns_enabled is
  'Pauses or resumes the caller''s Assistent pattern step. Deletes nothing (ADR-0060 §1).';

revoke execute on function public.set_assistant_patterns_enabled(boolean) from public, anon;
grant execute on function public.set_assistant_patterns_enabled(boolean) to authenticated, service_role;

-- ============================================================================
-- reserve_pattern_signal: same signature, owner and grants as before (create or
-- replace keeps them); adds the 'paused' result. Returns 'reserved' | 'exists'
-- | 'budget' | 'disabled' | 'paused' | 'invalid'. The public wrappers pass the
-- result through unchanged.
-- ============================================================================

create or replace function private.reserve_pattern_signal(
  p_user uuid, p_dedupe_key text, p_sources jsonb, p_locale text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_max_calls constant integer := 3;   -- per member per day (ADR-0046 §3)
  v_today timestamptz := (pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'Europe/Amsterdam'))
                         at time zone 'Europe/Amsterdam';
  v_len integer;
  v_owned integer;
  v_rows integer;
begin
  if p_user is null or p_dedupe_key is null or pg_catalog.length(p_dedupe_key) not between 1 and 200 then
    return 'invalid';
  end if;
  if p_locale is null or p_locale not in ('nl', 'en') then
    return 'invalid';
  end if;
  if p_sources is null or pg_catalog.jsonb_typeof(p_sources) <> 'array' then
    return 'invalid';
  end if;
  v_len := pg_catalog.jsonb_array_length(p_sources);
  if v_len not between 3 and 8 then
    return 'invalid';
  end if;

  -- Every element is {type: note|card, id: uuid} of a distinct source the member owns.
  begin
    select pg_catalog.count(*) into v_owned
    from (
      select distinct e ->> 'type' as t, (e ->> 'id')::uuid as id
      from pg_catalog.jsonb_array_elements(p_sources) e
    ) s
    where (s.t = 'note' and exists (select 1 from public.notes n where n.id = s.id and n.user_id = p_user))
       or (s.t = 'card' and exists (select 1 from public.cards c where c.id = s.id and c.user_id = p_user));
  exception when others then
    return 'invalid';
  end;
  if v_owned <> v_len then
    return 'invalid';
  end if;

  if not exists (select 1 from public.profiles pr where pr.id = p_user and pr.ai_enabled) then
    return 'disabled';
  end if;

  -- Paused (ADR-0060 §1): consent stays, but no call and no row. Checked before
  -- the budget so a paused member never touches agent_signals.
  if not exists (select 1 from public.profiles pr where pr.id = p_user and pr.assistant_patterns_enabled) then
    return 'paused';
  end if;

  -- Serialise concurrent lazy and cron runs of one member around the budget.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assistant_pattern:' || p_user::text, 0));

  if exists (
    select 1 from public.agent_signals s
    where s.user_id = p_user and s.kind = 'pattern' and s.dedupe_key = p_dedupe_key
  ) then
    return 'exists';
  end if;

  if (select pg_catalog.count(*) from public.agent_signals s
      where s.user_id = p_user and s.kind = 'pattern' and s.created_at >= v_today) >= v_max_calls then
    return 'budget';
  end if;

  insert into public.agent_signals (user_id, kind, dedupe_key, payload, locale, status)
  values (p_user, 'pattern', p_dedupe_key, pg_catalog.jsonb_build_object('sources', p_sources), p_locale, 'skipped')
  on conflict (user_id, kind, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'reserved' else 'exists' end;
end;
$$;
