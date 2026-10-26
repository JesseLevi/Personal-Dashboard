-- #628 (ADR-0046 §3-5): the pattern step of the Assistent. SQL proposes
-- neighbour edges between notes and cards, a definer function reserves a
-- candidate (budget, consent, ownership, dedupe) before the LLM is called and
-- completes it afterwards; plus a service_role-only member ordering for the
-- cron. Additive.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- ============================================================================
-- Neighbour edges (ADR-0046 §3). Seeds: the 40 notes and cards changed most
-- recently within 30 days. Neighbours: notes and cards with a cosine
-- similarity >= 0.80 (best chunk pair per source). Empty without ai_enabled.
-- Security invoker: the lazy path reads through RLS, the cron path runs as
-- service_role and passes the member explicitly.
-- ============================================================================

create function private.pattern_edges_scan(p_user uuid)
returns table (a_type text, a_id uuid, b_type text, b_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select 30 as seed_days, 40 as max_seeds, 0.80::double precision as min_similarity
  ),
  seeds as (
    select s.source_type, s.source_id
    from (
      select 'note'::text as source_type, n.id as source_id, n.updated_at
      from public.notes n, params p
      where n.user_id = p_user
        and n.updated_at >= pg_catalog.now() - pg_catalog.make_interval(days => p.seed_days)
      union all
      select 'card'::text, c.id, c.updated_at
      from public.cards c, params p
      where c.user_id = p_user
        and c.updated_at >= pg_catalog.now() - pg_catalog.make_interval(days => p.seed_days)
    ) s
    order by s.updated_at desc, s.source_id
    limit (select max_seeds from params)
  )
  select sd.source_type, sd.source_id, x.source_type, x.source_id, x.similarity
  from seeds sd
  cross join params p
  cross join lateral (
    select case when e2.note_id is not null then 'note' else 'card' end as source_type,
           coalesce(e2.note_id, e2.card_id) as source_id,
           pg_catalog.max(1 - (e2.embedding operator(extensions.<=>) e1.embedding))::double precision as similarity
    from public.embeddings e1
    join public.embeddings e2
      on e2.user_id = p_user and (e2.note_id is not null or e2.card_id is not null)
    where e1.user_id = p_user
      and coalesce(e1.note_id, e1.card_id) = sd.source_id
      and coalesce(e2.note_id, e2.card_id) <> sd.source_id
    group by 1, 2
    having pg_catalog.max(1 - (e2.embedding operator(extensions.<=>) e1.embedding)) >= p.min_similarity
  ) x
  where exists (select 1 from public.profiles pr where pr.id = p_user and pr.ai_enabled)
$$;

create function public.pattern_edges()
returns table (a_type text, a_id uuid, b_type text, b_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.pattern_edges_scan((select auth.uid()))
$$;

create function public.pattern_edges_for(p_user uuid)
returns table (a_type text, a_id uuid, b_type text, b_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.pattern_edges_scan(p_user)
$$;

comment on function public.pattern_edges is
  'Edges (cosine >= 0.80) from recently changed notes and cards to their note/card neighbours, for the caller. Empty without ai_enabled (ADR-0046 §3).';
comment on function public.pattern_edges_for is
  'Same for one member, for the cron route. service_role only (ADR-0046 §7).';

revoke execute on function private.pattern_edges_scan(uuid) from public, anon;
grant execute on function private.pattern_edges_scan(uuid) to authenticated, service_role;
revoke execute on function public.pattern_edges() from public, anon;
grant execute on function public.pattern_edges() to authenticated;
revoke execute on function public.pattern_edges_for(uuid) from public, anon, authenticated;
grant execute on function public.pattern_edges_for(uuid) to service_role;

-- ============================================================================
-- reserve_pattern_signal: called BEFORE the LLM. Writes a 'skipped' row, which
-- is what the daily budget counts and what keeps the cluster from being asked
-- again (ADR-0046 §3). The sources are checked for shape and ownership here, so
-- payload.sources (the only source of links) is SQL-vouched, never LLM output.
-- Returns 'reserved' | 'exists' | 'budget' | 'disabled' | 'invalid'.
-- ============================================================================

create function private.reserve_pattern_signal(
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

-- ============================================================================
-- complete_pattern_signal: called AFTER a helpful, validated answer. Only a
-- still-reserved row of that member can become 'new'.
-- ============================================================================

create function private.complete_pattern_signal(p_user uuid, p_dedupe_key text, p_message text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_rows integer;
begin
  if p_user is null or pg_catalog.length(v_message) not between 1 and 280 then
    return false;
  end if;
  update public.agent_signals s
  set message = v_message, status = 'new', status_changed_at = pg_catalog.now()
  where s.user_id = p_user and s.kind = 'pattern' and s.dedupe_key = p_dedupe_key
    and s.status = 'skipped' and s.message is null
    and exists (select 1 from public.profiles pr where pr.id = p_user and pr.ai_enabled);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.reserve_pattern_signal(p_dedupe_key text, p_sources jsonb, p_locale text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then 'invalid'
              else private.reserve_pattern_signal((select auth.uid()), p_dedupe_key, p_sources, p_locale) end
$$;

create function public.reserve_pattern_signal_for(
  p_user uuid, p_dedupe_key text, p_sources jsonb, p_locale text
)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reserve_pattern_signal(p_user, p_dedupe_key, p_sources, p_locale)
$$;

create function public.complete_pattern_signal(p_dedupe_key text, p_message text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then false
              else private.complete_pattern_signal((select auth.uid()), p_dedupe_key, p_message) end
$$;

create function public.complete_pattern_signal_for(p_user uuid, p_dedupe_key text, p_message text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.complete_pattern_signal(p_user, p_dedupe_key, p_message)
$$;

comment on function public.reserve_pattern_signal is
  'Reserves one pattern candidate of the caller before the LLM call: checks consent, ownership, dedupe and the 3-per-day budget, and writes a skipped row (ADR-0046 §3).';
comment on function public.reserve_pattern_signal_for is
  'Same for one member, for the cron route. service_role only.';
comment on function public.complete_pattern_signal is
  'Turns the caller''s reserved pattern row into a new signal with its validated message (ADR-0046 §3-4).';
comment on function public.complete_pattern_signal_for is
  'Same for one member, for the cron route. service_role only.';

revoke execute on function private.reserve_pattern_signal(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function private.complete_pattern_signal(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reserve_pattern_signal(text, jsonb, text) from public, anon;
grant execute on function public.reserve_pattern_signal(text, jsonb, text) to authenticated;
revoke execute on function public.complete_pattern_signal(text, text) from public, anon;
grant execute on function public.complete_pattern_signal(text, text) to authenticated;
revoke execute on function public.reserve_pattern_signal_for(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.reserve_pattern_signal_for(uuid, text, jsonb, text) to service_role;
revoke execute on function public.complete_pattern_signal_for(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_pattern_signal_for(uuid, text, text) to service_role;

-- ============================================================================
-- Cron ordering (#626 follow-up): members whose last Assistent run is oldest
-- (or who never had one) first. private.assistant_runs is not readable over
-- PostgREST, so this definer function is the way. service_role only.
-- ============================================================================

create function public.assistant_members_by_last_run()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  left join private.assistant_runs r on r.user_id = p.id
  order by r.last_run_at nulls first, p.id
$$;

comment on function public.assistant_members_by_last_run is
  'Member ids ordered by oldest last Assistent run first, never-run first. service_role only (cron).';

revoke execute on function public.assistant_members_by_last_run() from public, anon, authenticated;
grant execute on function public.assistant_members_by_last_run() to service_role;
