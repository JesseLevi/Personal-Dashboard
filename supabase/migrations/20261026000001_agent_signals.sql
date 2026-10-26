-- #624 (ADR-0046): public.agent_signals, the status RPC, the assistant run
-- throttle and the two deterministic rhythm detectors. Additive, except that
-- set_ai_enabled() gains one extra delete.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create table public.agent_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('buy_rhythm', 'cook_rhythm', 'pattern')),
  dedupe_key text not null,
  payload jsonb not null,
  message text check (char_length(message) <= 400),
  locale text,
  status text not null default 'new' check (status in ('new', 'dismissed', 'acted', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);

comment on table public.agent_signals is
  'Assistent signals (ADR-0046). Owner reads; written only by definer functions. message is set for pattern signals only.';

create index agent_signals_user_status_idx
  on public.agent_signals (user_id, status, created_at desc);

create trigger agent_signals_set_updated_at
  before update on public.agent_signals
  for each row execute function public.set_updated_at();

alter table public.agent_signals enable row level security;

create policy agent_signals_select_own on public.agent_signals
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.agent_signals from anon, authenticated;
grant select on public.agent_signals to authenticated;
grant select, insert, update, delete on public.agent_signals to service_role;

-- ============================================================================
-- set_agent_signal_status: new -> dismissed | acted, on the caller's own rows
-- ============================================================================

create function public.set_agent_signal_status(p_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('dismissed', 'acted') then
    raise exception 'invalid status transition' using errcode = '22023';
  end if;

  select s.status into v_current
  from public.agent_signals s
  where s.id = p_id and s.user_id = v_uid
  for update;

  if not found then
    raise exception 'signal not found' using errcode = 'P0002';
  end if;
  if v_current <> 'new' then
    raise exception 'invalid status transition' using errcode = '22023';
  end if;

  update public.agent_signals
  set status = p_status, status_changed_at = pg_catalog.now()
  where id = p_id;
end;
$$;

comment on function public.set_agent_signal_status is
  'Moves one of the caller''s signals from new to dismissed or acted; anything else raises (ADR-0046 §5).';

revoke execute on function public.set_agent_signal_status(uuid, text) from public, anon;
grant execute on function public.set_agent_signal_status(uuid, text) to authenticated;

-- ============================================================================
-- Run throttle (ADR-0046 §7), same shape as claim_embedding_drain()
-- ============================================================================

create table private.assistant_runs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_run_at timestamptz not null default now()
);

comment on table private.assistant_runs is
  'Last lazy Assistent run per member (ADR-0046 §7). Only claim_assistant_run() touches it.';

alter table private.assistant_runs enable row level security;
revoke all on private.assistant_runs from anon, authenticated;

create function public.claim_assistant_run()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claimed boolean;
begin
  if v_uid is null then
    return false;
  end if;

  insert into private.assistant_runs as r (user_id, last_run_at)
  values (v_uid, pg_catalog.now())
  on conflict (user_id) do update
    set last_run_at = pg_catalog.now()
    where r.last_run_at < pg_catalog.now() - interval '6 hours'
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

comment on function public.claim_assistant_run is
  'Atomically claims the lazy Assistent slot of the caller: true (and stamps now()) when the last run was over 6 hours ago, else false.';

revoke execute on function public.claim_assistant_run() from public, anon;
grant execute on function public.claim_assistant_run() to authenticated, service_role;

-- ============================================================================
-- Rhythm candidates. Thresholds below must stay equal to ADR-0046 §2.
--   buy_rhythm : >= 4 purchase days, median interval 5..120 days,
--                days since last >= round(0.85 * median), 365-day window
--   cook_rhythm: >= 3 cook days, median interval <= 60 days,
--                days since last >= greatest(2 * median, 21), 365-day window
-- Days are Europe/Amsterdam calendar days, as in settle_cooked_meals.
-- ============================================================================

create function private.buy_rhythm_candidates(p_user uuid)
returns table (dedupe_key text, payload jsonb, overdue numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select 365 as window_days, 4 as min_purchases,
           5 as min_median, 120 as max_median, 0.85 as due_factor,
           (pg_catalog.now() at time zone 'Europe/Amsterdam')::date as today
  ),
  days as (
    select e.item_key,
           (e.occurred_at at time zone 'Europe/Amsterdam')::date as d
    from public.activity_events e, params p
    where e.user_id = p_user
      and e.kind = 'basket_item_checked'
      and e.item_key is not null
      and e.occurred_at >= pg_catalog.now() - pg_catalog.make_interval(days => p.window_days)
    group by 1, 2
  ),
  gaps as (
    select item_key, d, d - pg_catalog.lag(d) over (partition by item_key order by d) as gap
    from days
  ),
  stats as (
    select item_key,
           pg_catalog.count(*) as purchases,
           pg_catalog.max(d) as last_day,
           (pg_catalog.percentile_cont(0.5) within group (order by gap))::numeric as median_days
    from gaps
    group by item_key
  ),
  due as (
    select s.*, (p.today - s.last_day) as days_since,
           pg_catalog.round(p.due_factor * s.median_days) as due_after
    from stats s, params p
    where s.purchases >= p.min_purchases
      and s.median_days between p.min_median and p.max_median
      and (p.today - s.last_day) >= pg_catalog.round(p.due_factor * s.median_days)
  )
  select d.item_key || ':' || d.last_day::text,
         pg_catalog.jsonb_build_object(
           'item_key', d.item_key,
           'item_name', (
             select a.item_name from public.activity_events a
             where a.user_id = p_user and a.item_key = d.item_key
               and a.kind in ('basket_item_added', 'basket_item_checked')
             order by a.occurred_at desc, a.id desc limit 1),
           'median_days', pg_catalog.round(d.median_days, 1),
           'days_since', d.days_since,
           'purchases', d.purchases),
         (d.days_since - d.due_after)::numeric
  from due d
  where not exists (
    select 1 from public.shopping_list_items i
    where i.user_id = p_user and not i.checked
      and private.activity_item_key(i.name) = d.item_key
  )
$$;

create function private.cook_rhythm_candidates(p_user uuid)
returns table (dedupe_key text, payload jsonb, overdue numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select 365 as window_days, 3 as min_times, 60 as max_median,
           2 as due_multiplier, 21 as min_due_days,
           (pg_catalog.now() at time zone 'Europe/Amsterdam')::date as today
  ),
  days as (
    select e.recipe_id,
           (e.occurred_at at time zone 'Europe/Amsterdam')::date as d
    from public.activity_events e, params p
    where e.user_id = p_user
      and e.kind = 'recipe_cooked'
      and e.recipe_id is not null
      and e.occurred_at >= pg_catalog.now() - pg_catalog.make_interval(days => p.window_days)
    group by 1, 2
  ),
  gaps as (
    select recipe_id, d, d - pg_catalog.lag(d) over (partition by recipe_id order by d) as gap
    from days
  ),
  stats as (
    select recipe_id,
           pg_catalog.count(*) as times,
           pg_catalog.max(d) as last_day,
           (pg_catalog.percentile_cont(0.5) within group (order by gap))::numeric as median_days
    from gaps
    group by recipe_id
  ),
  due as (
    select s.*, (p.today - s.last_day) as days_since,
           greatest(p.due_multiplier * s.median_days, p.min_due_days) as due_after
    from stats s, params p
    where s.times >= p.min_times
      and s.median_days <= p.max_median
      and (p.today - s.last_day)
          >= greatest(p.due_multiplier * s.median_days, p.min_due_days)
  )
  select d.recipe_id::text || ':' || d.last_day::text,
         pg_catalog.jsonb_build_object(
           'recipe_id', d.recipe_id,
           'median_days', pg_catalog.round(d.median_days, 1),
           'days_since', d.days_since,
           'times', d.times),
         (d.days_since - d.due_after)::numeric
  from due d
  where not exists (
    select 1
    from public.meal_plans m
    left join public.calendar_events ce on ce.id = m.calendar_event_id
    where m.user_id = p_user and m.recipe_id = d.recipe_id
      and coalesce((ce.starts_at at time zone 'Europe/Amsterdam')::date, m.planned_on)
          >= (pg_catalog.now() at time zone 'Europe/Amsterdam')::date
  )
$$;

revoke execute on function private.buy_rhythm_candidates(uuid) from public, anon, authenticated;
revoke execute on function private.cook_rhythm_candidates(uuid) from public, anon, authenticated;

-- ============================================================================
-- detect_rhythm_signals: one shared implementation
-- ============================================================================

create function private.detect_rhythm_signals(p_user uuid)
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

create function public.detect_rhythm_signals()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then 0
              else private.detect_rhythm_signals((select auth.uid())) end
$$;

create function public.detect_rhythm_signals_for(p_user uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.detect_rhythm_signals(p_user)
$$;

comment on function public.detect_rhythm_signals is
  'Writes buy_rhythm and cook_rhythm signals for the caller; returns the number of new ones (ADR-0046 §2).';
comment on function public.detect_rhythm_signals_for is
  'Same for one member, for the cron route. service_role only (ADR-0046 §7).';

revoke execute on function private.detect_rhythm_signals(uuid) from public, anon, authenticated;
revoke execute on function public.detect_rhythm_signals() from public, anon;
grant execute on function public.detect_rhythm_signals() to authenticated;
revoke execute on function public.detect_rhythm_signals_for(uuid) from public, anon, authenticated;
grant execute on function public.detect_rhythm_signals_for(uuid) to service_role;

-- ============================================================================
-- set_ai_enabled: turning it off also deletes the pattern signals (ADR-0046 §6)
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
  end if;
end;
$$;
