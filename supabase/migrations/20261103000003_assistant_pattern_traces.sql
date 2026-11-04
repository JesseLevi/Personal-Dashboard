-- #757 (ADR-0060 §3): public.assistant_pattern_traces, what Haiku saw and said for
-- one candidate cluster (or what it would have received while the pattern step is
-- paused), for the owner only. The owner selects; the only writers are the definer
-- record_assistant_pattern_trace() on auth.uid() and its service_role-only
-- _for(user) variant. The detector run deletes traces 90 days after last_seen_at,
-- set_ai_enabled(false) deletes them in the same transaction, and deleting the
-- account cascades. Additive.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create table public.assistant_pattern_traces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_key text not null,
  status text not null check (status in ('asked', 'paused')),
  items jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(items) = 'array'),
  similarities jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(similarities) = 'array'),
  prompt_version text not null check (pg_catalog.length(prompt_version) <= 40),
  model text not null check (pg_catalog.length(model) <= 100),
  answer jsonb check (answer is null or pg_catalog.jsonb_typeof(answer) = 'object'),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  signal_id uuid references public.agent_signals (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1 check (seen_count >= 1),
  unique (user_id, dedupe_key)
);

comment on table public.assistant_pattern_traces is
  'What Haiku saw and said for one candidate cluster, or what it would have received while paused (ADR-0060 §3). Owner-select; written only by record_assistant_pattern_trace*(). Deleted 90 days after last_seen_at, and when ai_enabled is turned off.';

create index assistant_pattern_traces_user_seen_idx
  on public.assistant_pattern_traces (user_id, last_seen_at desc);
create index assistant_pattern_traces_seen_idx
  on public.assistant_pattern_traces (last_seen_at);
create index assistant_pattern_traces_signal_idx
  on public.assistant_pattern_traces (signal_id);

alter table public.assistant_pattern_traces enable row level security;

create policy assistant_pattern_traces_select_own on public.assistant_pattern_traces
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.assistant_pattern_traces from anon, authenticated;
grant select on public.assistant_pattern_traces to authenticated;
grant select, insert, update, delete on public.assistant_pattern_traces to service_role;

-- ============================================================================
-- Writers. Consent is checked here: a member without ai_enabled gets no row.
-- Returns true when a row was written.
--   * a new cluster inserts a row;
--   * a paused cluster seen again only bumps last_seen_at and seen_count;
--   * a cluster that was paused and is asked later becomes 'asked' and keeps the
--     answer; the link to its agent_signals row is looked up here.
-- ============================================================================

create function private.record_assistant_pattern_trace(
  p_user uuid,
  p_status text,
  p_dedupe_key text,
  p_items jsonb,
  p_similarities jsonb,
  p_prompt_version text,
  p_model text,
  p_answer jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_duration_ms integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_signal uuid;
begin
  if p_user is null then
    return false;
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = p_user and pr.ai_enabled) then
    return false;
  end if;

  if p_status = 'asked' then
    select s.id into v_signal
    from public.agent_signals s
    where s.user_id = p_user and s.kind = 'pattern' and s.dedupe_key = p_dedupe_key;
  end if;

  insert into public.assistant_pattern_traces as t (
    user_id, dedupe_key, status, items, similarities, prompt_version, model, answer,
    input_tokens, output_tokens, duration_ms, signal_id
  ) values (
    p_user, p_dedupe_key, p_status,
    coalesce(p_items, '[]'::jsonb), coalesce(p_similarities, '[]'::jsonb),
    p_prompt_version, p_model, p_answer,
    coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_duration_ms, 0),
    v_signal
  )
  on conflict (user_id, dedupe_key) do update
  set last_seen_at = pg_catalog.clock_timestamp(),
      seen_count = t.seen_count + 1,
      status = case when excluded.status = 'asked' then 'asked' else t.status end,
      items = case when excluded.status = 'asked' then excluded.items else t.items end,
      similarities = case when excluded.status = 'asked' then excluded.similarities else t.similarities end,
      prompt_version = case when excluded.status = 'asked' then excluded.prompt_version else t.prompt_version end,
      model = case when excluded.status = 'asked' then excluded.model else t.model end,
      answer = case when excluded.status = 'asked' then excluded.answer else t.answer end,
      input_tokens = case when excluded.status = 'asked' then excluded.input_tokens else t.input_tokens end,
      output_tokens = case when excluded.status = 'asked' then excluded.output_tokens else t.output_tokens end,
      duration_ms = case when excluded.status = 'asked' then excluded.duration_ms else t.duration_ms end,
      signal_id = case when excluded.status = 'asked' then excluded.signal_id else t.signal_id end;
  return true;
end;
$$;

create function public.record_assistant_pattern_trace(
  p_status text,
  p_dedupe_key text,
  p_items jsonb,
  p_similarities jsonb,
  p_prompt_version text,
  p_model text,
  p_answer jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_duration_ms integer
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then false
    else private.record_assistant_pattern_trace(
      (select auth.uid()), p_status, p_dedupe_key, p_items, p_similarities,
      p_prompt_version, p_model, p_answer, p_input_tokens, p_output_tokens, p_duration_ms) end
$$;

create function public.record_assistant_pattern_trace_for(
  p_user uuid,
  p_status text,
  p_dedupe_key text,
  p_items jsonb,
  p_similarities jsonb,
  p_prompt_version text,
  p_model text,
  p_answer jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_duration_ms integer
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_assistant_pattern_trace(
    p_user, p_status, p_dedupe_key, p_items, p_similarities,
    p_prompt_version, p_model, p_answer, p_input_tokens, p_output_tokens, p_duration_ms)
$$;

comment on function public.record_assistant_pattern_trace is
  'Writes or updates the caller''s trace of one cluster when the caller has ai_enabled; returns whether a row was written (ADR-0060 §3).';
comment on function public.record_assistant_pattern_trace_for is
  'Same for one member, for the cron route. service_role only.';

revoke execute on function private.record_assistant_pattern_trace(
  uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer
) from public, anon, authenticated;

revoke execute on function public.record_assistant_pattern_trace(
  text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer
) from public, anon;
grant execute on function public.record_assistant_pattern_trace(
  text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer
) to authenticated;

revoke execute on function public.record_assistant_pattern_trace_for(
  uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_assistant_pattern_trace_for(
  uuid, text, text, jsonb, jsonb, text, text, jsonb, integer, integer, integer
) to service_role;

-- ============================================================================
-- set_ai_enabled: turning it off also deletes the member's traces (ADR-0060 §3).
-- Same body as before plus one delete.
-- ============================================================================

create or replace function public.set_ai_enabled(p_enabled boolean)
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
  set ai_enabled = p_enabled,
      ai_enabled_at = case
        when not p_enabled then null
        when ai_enabled then ai_enabled_at
        else pg_catalog.now()
      end
  where id = v_uid;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if not p_enabled then
    delete from public.embeddings where user_id = v_uid;
    delete from public.agent_signals where user_id = v_uid and kind = 'pattern';
    delete from public.assistant_pattern_traces where user_id = v_uid;
  end if;
end;
$$;

-- ============================================================================
-- detect_rhythm_signals: same body as before plus the 90-day delete of traces
-- (ADR-0060 §3). Signature, owner and grants are kept by create or replace.
-- ============================================================================

create or replace function private.detect_rhythm_signals(p_user uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_max_new constant integer := 5;        -- per kind per run (ADR-0046 §2)
  v_prune_days constant integer := 180;   -- closed rows (ADR-0046 §5)
  v_trace_days constant integer := 90;    -- traces after last_seen_at (ADR-0060 §3)
  v_rows integer;
  v_total integer := 0;
begin
  -- Open signals whose condition no longer holds.
  delete from public.agent_signals s
  where s.user_id = p_user and s.kind = 'buy_rhythm' and s.status = 'new'
    and not exists (
      select 1 from private.buy_rhythm_candidates(p_user) c where c.dedupe_key = s.dedupe_key);
  delete from public.agent_signals s
  where s.user_id = p_user and s.kind = 'cook_rhythm' and s.status = 'new'
    and not exists (
      select 1 from private.cook_rhythm_candidates(p_user) c where c.dedupe_key = s.dedupe_key);

  delete from public.agent_signals s
  where s.user_id = p_user and s.status in ('dismissed', 'acted', 'skipped')
    and s.status_changed_at < pg_catalog.now() - pg_catalog.make_interval(days => v_prune_days);

  -- Run log of the pattern step (ADR-0060 §2).
  delete from public.assistant_pattern_runs r
  where r.user_id = p_user
    and r.started_at < pg_catalog.now() - pg_catalog.make_interval(days => v_prune_days);

  -- Traces of the pattern step (ADR-0060 §3).
  delete from public.assistant_pattern_traces t
  where t.user_id = p_user
    and t.last_seen_at < pg_catalog.now() - pg_catalog.make_interval(days => v_trace_days);

  -- Already-known cycles (any status) are filtered first, so the cap of five
  -- counts new signals only.
  insert into public.agent_signals (user_id, kind, dedupe_key, payload)
  select p_user, 'buy_rhythm', c.dedupe_key, c.payload
  from private.buy_rhythm_candidates(p_user) c
  where not exists (
    select 1 from public.agent_signals s
    where s.user_id = p_user and s.kind = 'buy_rhythm' and s.dedupe_key = c.dedupe_key)
  order by c.overdue desc, c.dedupe_key
  limit v_max_new
  on conflict (user_id, kind, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  insert into public.agent_signals (user_id, kind, dedupe_key, payload)
  select p_user, 'cook_rhythm', c.dedupe_key, c.payload
  from private.cook_rhythm_candidates(p_user) c
  where not exists (
    select 1 from public.agent_signals s
    where s.user_id = p_user and s.kind = 'cook_rhythm' and s.dedupe_key = c.dedupe_key)
  order by c.overdue desc, c.dedupe_key
  limit v_max_new
  on conflict (user_id, kind, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  return v_total;
end;
$$;
