-- #756 (ADR-0060 §2): public.assistant_pattern_runs, one row per pattern step of
-- a member with opt-in, counts only (never content). The owner selects; the only
-- writers are the definer record_assistant_pattern_run() on auth.uid() and its
-- service_role-only _for(user) variant. The detector run prunes rows older than
-- 180 days, and private.assistant_pattern_daily sums the funnel per day over all
-- members without user_id, for the SQL editor. Additive.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create table public.assistant_pattern_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (path in ('lazy', 'cron')),
  started_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  outcome text not null
    check (outcome in ('no_edges', 'no_clusters', 'all_known', 'no_candidates', 'paused', 'budget', 'ok', 'error')),
  error_code text check (error_code is null or pg_catalog.length(error_code) <= 40),
  edges integer not null default 0 check (edges >= 0),
  similarity_bands jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(similarity_bands) = 'object'),
  clusters integer not null default 0 check (clusters >= 0),
  cluster_sizes jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(cluster_sizes) = 'object'),
  known integer not null default 0 check (known >= 0),
  not_fresh integer not null default 0 check (not_fresh >= 0),
  candidates integer not null default 0 check (candidates >= 0),
  calls integer not null default 0 check (calls >= 0),
  helpful integer not null default 0 check (helpful >= 0),
  not_helpful integer not null default 0 check (not_helpful >= 0),
  rejected_by_cleaner integer not null default 0 check (rejected_by_cleaner >= 0),
  call_failures integer not null default 0 check (call_failures >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  config jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.assistant_pattern_runs is
  'One row per Assistent pattern step of a member with opt-in: the funnel as counts, never content (ADR-0060 §2). Owner-select; written only by record_assistant_pattern_run*(). Pruned after 180 days by the detector run.';

create index assistant_pattern_runs_user_started_idx
  on public.assistant_pattern_runs (user_id, started_at desc);
create index assistant_pattern_runs_started_idx
  on public.assistant_pattern_runs (started_at);

alter table public.assistant_pattern_runs enable row level security;

create policy assistant_pattern_runs_select_own on public.assistant_pattern_runs
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.assistant_pattern_runs from anon, authenticated;
grant select on public.assistant_pattern_runs to authenticated;
grant select, insert, update, delete on public.assistant_pattern_runs to service_role;

-- ============================================================================
-- Writers. Consent is checked here: a member without ai_enabled gets no row.
-- Returns true when a row was written.
-- ============================================================================

create function private.record_assistant_pattern_run(
  p_user uuid,
  p_path text,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_outcome text,
  p_error_code text,
  p_edges integer,
  p_similarity_bands jsonb,
  p_clusters integer,
  p_cluster_sizes jsonb,
  p_known integer,
  p_not_fresh integer,
  p_candidates integer,
  p_calls integer,
  p_helpful integer,
  p_not_helpful integer,
  p_rejected_by_cleaner integer,
  p_call_failures integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_config jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return false;
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = p_user and pr.ai_enabled) then
    return false;
  end if;

  insert into public.assistant_pattern_runs (
    user_id, path, started_at, duration_ms, outcome, error_code,
    edges, similarity_bands, clusters, cluster_sizes, known, not_fresh, candidates,
    calls, helpful, not_helpful, rejected_by_cleaner, call_failures,
    input_tokens, output_tokens, config
  ) values (
    p_user, p_path, p_started_at, p_duration_ms, p_outcome, nullif(p_error_code, ''),
    coalesce(p_edges, 0),coalesce(p_similarity_bands, '{}'::jsonb),
    coalesce(p_clusters, 0), coalesce(p_cluster_sizes, '{}'::jsonb),
    coalesce(p_known, 0), coalesce(p_not_fresh, 0), coalesce(p_candidates, 0),
    coalesce(p_calls, 0), coalesce(p_helpful, 0), coalesce(p_not_helpful, 0),
    coalesce(p_rejected_by_cleaner, 0), coalesce(p_call_failures, 0),
    coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_config, '{}'::jsonb)
  );
  return true;
end;
$$;

create function public.record_assistant_pattern_run(
  p_path text,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_outcome text,
  p_error_code text,
  p_edges integer,
  p_similarity_bands jsonb,
  p_clusters integer,
  p_cluster_sizes jsonb,
  p_known integer,
  p_not_fresh integer,
  p_candidates integer,
  p_calls integer,
  p_helpful integer,
  p_not_helpful integer,
  p_rejected_by_cleaner integer,
  p_call_failures integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_config jsonb
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then false
    else private.record_assistant_pattern_run(
      (select auth.uid()), p_path, p_started_at, p_duration_ms, p_outcome, p_error_code,
      p_edges, p_similarity_bands, p_clusters, p_cluster_sizes, p_known, p_not_fresh, p_candidates,
      p_calls, p_helpful, p_not_helpful, p_rejected_by_cleaner, p_call_failures,
      p_input_tokens, p_output_tokens, p_config) end
$$;

create function public.record_assistant_pattern_run_for(
  p_user uuid,
  p_path text,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_outcome text,
  p_error_code text,
  p_edges integer,
  p_similarity_bands jsonb,
  p_clusters integer,
  p_cluster_sizes jsonb,
  p_known integer,
  p_not_fresh integer,
  p_candidates integer,
  p_calls integer,
  p_helpful integer,
  p_not_helpful integer,
  p_rejected_by_cleaner integer,
  p_call_failures integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_config jsonb
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.record_assistant_pattern_run(
    p_user, p_path, p_started_at, p_duration_ms, p_outcome, p_error_code,
    p_edges, p_similarity_bands, p_clusters, p_cluster_sizes, p_known, p_not_fresh, p_candidates,
    p_calls, p_helpful, p_not_helpful, p_rejected_by_cleaner, p_call_failures,
    p_input_tokens, p_output_tokens, p_config)
$$;

comment on function public.record_assistant_pattern_run is
  'Writes the caller''s pattern-step funnel row when the caller has ai_enabled; returns whether a row was written (ADR-0060 §2).';
comment on function public.record_assistant_pattern_run_for is
  'Same for one member, for the cron route. service_role only.';

revoke execute on function private.record_assistant_pattern_run(
  uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb,
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;

revoke execute on function public.record_assistant_pattern_run(
  text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb,
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb
) from public, anon;
grant execute on function public.record_assistant_pattern_run(
  text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb,
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb
) to authenticated;

revoke execute on function public.record_assistant_pattern_run_for(
  uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb,
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.record_assistant_pattern_run_for(
  uuid, text, timestamptz, integer, text, text, integer, jsonb, integer, jsonb,
  integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, jsonb
) to service_role;

-- ============================================================================
-- Operator view: the funnel per day (Europe/Amsterdam) over all members, no
-- user_id. Reachable by the SQL editor only: private is closed to clients.
-- ============================================================================

create view private.assistant_pattern_daily as
select
  (r.started_at at time zone 'Europe/Amsterdam')::date as day,
  count(*)::integer as runs,
  count(*) filter (where r.outcome = 'no_edges')::integer as no_edges_runs,
  count(*) filter (where r.outcome = 'no_clusters')::integer as no_clusters_runs,
  count(*) filter (where r.outcome = 'all_known')::integer as all_known_runs,
  count(*) filter (where r.outcome = 'no_candidates')::integer as no_candidates_runs,
  count(*) filter (where r.outcome = 'paused')::integer as paused_runs,
  count(*) filter (where r.outcome = 'budget')::integer as budget_runs,
  count(*) filter (where r.outcome = 'ok')::integer as ok_runs,
  count(*) filter (where r.outcome = 'error')::integer as error_runs,
  sum(r.edges)::integer as edges,
  sum((r.similarity_bands ->> '0.80')::integer)::integer as band_080,
  sum((r.similarity_bands ->> '0.85')::integer)::integer as band_085,
  sum((r.similarity_bands ->> '0.90')::integer)::integer as band_090,
  sum((r.similarity_bands ->> '0.95')::integer)::integer as band_095,
  sum(r.clusters)::integer as clusters,
  sum((r.cluster_sizes ->> '3')::integer)::integer as size_3,
  sum((r.cluster_sizes ->> '4')::integer)::integer as size_4,
  sum((r.cluster_sizes ->> '5')::integer)::integer as size_5,
  sum((r.cluster_sizes ->> '6')::integer)::integer as size_6,
  sum((r.cluster_sizes ->> '7')::integer)::integer as size_7,
  sum((r.cluster_sizes ->> '8')::integer)::integer as size_8,
  sum(r.known)::integer as known,
  sum(r.not_fresh)::integer as not_fresh,
  sum(r.candidates)::integer as candidates,
  sum(r.calls)::integer as calls,
  sum(r.helpful)::integer as helpful,
  sum(r.not_helpful)::integer as not_helpful,
  sum(r.rejected_by_cleaner)::integer as rejected_by_cleaner,
  sum(r.call_failures)::integer as call_failures,
  sum(r.input_tokens)::integer as input_tokens,
  sum(r.output_tokens)::integer as output_tokens
from public.assistant_pattern_runs r
group by 1;

comment on view private.assistant_pattern_daily is
  'Pattern-step funnel per day over all members, without user_id. SQL editor only (ADR-0060 §2).';

revoke all on private.assistant_pattern_daily from public, anon, authenticated;

-- ============================================================================
-- detect_rhythm_signals: same body as before plus the 180-day prune of the run
-- log (ADR-0060 §2). Signature, owner and grants are kept by create or replace.
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
