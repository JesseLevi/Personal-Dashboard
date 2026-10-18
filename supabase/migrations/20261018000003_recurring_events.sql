-- #531 (epic #527, ADR-0042): recurring own events as materialised series.
--   calendar_event_series (rule + template), series columns on calendar_events,
--   the create / update / delete / extend RPCs, and agenda_items() with series_id.
--
-- Additive only (ADR-0032 §5). Not applied to hosted by merging: needs the
-- user's explicit go.
--
-- Errors from the RPCs carry custom SQLSTATEs (ADR-0015 form):
--   AG404 not found (or not visible to the caller), AG403 imported calendar
--   (read-only), AG422 invalid input (scope, time zone, too many occurrences).

-- ============================================================================
-- calendar_event_series
-- ============================================================================

create table public.calendar_event_series (
  id uuid primary key default gen_random_uuid(),
  -- Always the calendar owner's id; set by the BEFORE trigger below.
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null,
  location text,
  description text check (description is null or char_length(description) <= 2000),
  all_day boolean not null default false,
  -- First occurrence, as a date in time_zone.
  starts_on date not null,
  -- Wall-clock start in time_zone; null for an all-day series.
  start_time time,
  -- Wall-clock length. All-day: a multiple of 1440 (whole days).
  duration_minutes integer not null,
  time_zone text not null default 'Europe/Amsterdam',
  freq text not null check (freq in ('daily', 'weekly', 'monthly', 'yearly')),
  "interval" integer not null default 1 check ("interval" between 1 and 99),
  -- Last day an occurrence may fall on (inclusive); null = never ends.
  until date,
  -- Occurrence dates deleted one by one; extension never recreates them.
  excluded_on date[] not null default '{}',
  -- Occurrences exist up to and including this date.
  materialized_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (until is null or until >= starts_on),
  check (
    (all_day and start_time is null and duration_minutes >= 1440 and duration_minutes % 1440 = 0)
    or (not all_day and start_time is not null and duration_minutes >= 0)
  )
);

comment on table public.calendar_event_series is
  'Rule and template of a recurring own event (ADR-0042). Each occurrence is an ordinary calendar_events row (source manual) with series_id and occurrence_on. Written through the *_event_series RPCs; occurrences are generated in time_zone wall-clock time up to 400 days ahead.';

create index calendar_event_series_calendar_id_idx on public.calendar_event_series (calendar_id);
create index calendar_event_series_user_id_idx on public.calendar_event_series (user_id);

create trigger calendar_event_series_set_updated_at
  before update on public.calendar_event_series
  for each row execute function public.set_updated_at();

create function private.calendar_event_series_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.calendars where id = new.calendar_id;
  if v_owner is null then
    raise exception 'unknown calendar' using errcode = '23503';
  end if;
  new.user_id := v_owner;
  return new;
end;
$$;

create trigger calendar_event_series_set_owner
  before insert or update of calendar_id, user_id on public.calendar_event_series
  for each row execute function private.calendar_event_series_set_owner();

alter table public.calendar_event_series enable row level security;

create policy calendar_event_series_select_member on public.calendar_event_series
  for select to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy calendar_event_series_insert_member on public.calendar_event_series
  for insert to authenticated
  with check (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy calendar_event_series_update_member on public.calendar_event_series
  for update to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'))
  with check (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy calendar_event_series_delete_member on public.calendar_event_series
  for delete to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));

revoke all on public.calendar_event_series from anon, authenticated;
grant select, insert, delete on public.calendar_event_series to authenticated;
-- user_id, calendar_id and time_zone are fixed once a series exists.
grant update (
  title, location, description, all_day, starts_on, start_time, duration_minutes,
  freq, "interval", until, excluded_on, materialized_until, updated_at
) on public.calendar_event_series to authenticated;
grant select, insert, update, delete on public.calendar_event_series to service_role;

-- ============================================================================
-- calendar_events: the occurrence columns
-- ============================================================================

alter table public.calendar_events
  add column series_id uuid references public.calendar_event_series (id) on delete cascade,
  -- The occurrence's original date; a dragged occurrence keeps it.
  add column occurrence_on date,
  -- Set when this occurrence was changed on its own: extension and "Alle" skip it.
  add column series_detached boolean not null default false,
  add constraint calendar_events_series_manual check (series_id is null or source = 'manual'),
  add constraint calendar_events_series_pair check ((series_id is null) = (occurrence_on is null)),
  add constraint calendar_events_detached_in_series check (not series_detached or series_id is not null),
  add constraint calendar_events_series_occurrence_key unique (series_id, occurrence_on);

-- A client may only point an event at a series of the same calendar it can read
-- (the FK check itself bypasses RLS).
drop policy calendar_events_insert_member on public.calendar_events;
create policy calendar_events_insert_member on public.calendar_events
  for insert to authenticated
  with check (
    private.calendar_role(calendar_id) in ('owner', 'editor')
    and source = 'manual'
    and (
      series_id is null
      or exists (
        select 1 from public.calendar_event_series s
        where s.id = calendar_events.series_id and s.calendar_id = calendar_events.calendar_id
      )
    )
  );

drop policy calendar_events_update_member on public.calendar_events;
create policy calendar_events_update_member on public.calendar_events
  for update to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'))
  with check (
    private.calendar_role(calendar_id) in ('owner', 'editor')
    and (
      series_id is null
      or exists (
        select 1 from public.calendar_event_series s
        where s.id = calendar_events.series_id and s.calendar_id = calendar_events.calendar_id
      )
    )
  );

grant update (series_id, occurrence_on, series_detached) on public.calendar_events to authenticated;

-- ============================================================================
-- Helpers (schema private; clients reach them only through the RPCs' invoker rights)
-- ============================================================================

-- The dates of a rule inside [p_from, p_to]. A month without the start's day is
-- skipped (RFC 5545), so 31 Jan monthly gives Jan, Mar, May, ...
create function private.series_dates(
  p_starts_on date,
  p_freq text,
  p_interval integer,
  p_from date,
  p_to date
)
returns table (d date)
language sql
stable
set search_path = ''
as $$
  select c.d
  from generate_series(
         0,
         (p_to - p_starts_on)
           / (case p_freq when 'daily' then 1 when 'weekly' then 7 when 'monthly' then 28 else 365 end
              * p_interval)
           + 1
       ) as k
  cross join lateral (
    select (date_trunc('month', p_starts_on::timestamp)::date
            + make_interval(months => k * p_interval * (case when p_freq = 'yearly' then 12 else 1 end))
           )::date as month_start
  ) as m
  cross join lateral (
    select case p_freq
             when 'daily' then p_starts_on + k * p_interval
             when 'weekly' then p_starts_on + k * p_interval * 7
             else m.month_start + (extract(day from p_starts_on)::integer - 1)
           end as d
  ) as c
  where c.d between p_from and p_to
    and (p_freq in ('daily', 'weekly') or c.d < (m.month_start + interval '1 month'))
  order by c.d
$$;

create function private.occurrence_starts_at(
  p_date date,
  p_start_time time,
  p_all_day boolean,
  p_time_zone text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
           when p_all_day then (p_date::timestamp) at time zone 'UTC'
           else (p_date + p_start_time) at time zone p_time_zone
         end
$$;

create function private.occurrence_ends_at(
  p_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_all_day boolean,
  p_time_zone text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
           when p_all_day then ((p_date + p_duration_minutes / 1440)::timestamp) at time zone 'UTC'
           else (p_date + p_start_time + make_interval(mins => p_duration_minutes)) at time zone p_time_zone
         end
$$;

-- Writes the occurrences of a series from p_cut on, up to 400 days ahead (or
-- the series' end). p_reuse lists existing occurrence ids, in date order, that
-- take the first generated dates in turn and keep their id (so links and meal
-- plans survive); ids beyond the generated dates are deleted, dates beyond the
-- ids are inserted. Dates in excluded_on, and dates another row of the series
-- already holds (a detached occurrence), are skipped.
create function private.fill_series(
  p_series_id uuid,
  p_reuse uuid[],
  p_cut date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_s public.calendar_event_series%rowtype;
  v_reuse uuid[] := coalesce(p_reuse, '{}'::uuid[]);
  v_old integer := coalesce(cardinality(p_reuse), 0);
  v_new integer;
  v_to date;
  v_dates date[];
begin
  select * into v_s from public.calendar_event_series where id = p_series_id for update;
  if not found then
    raise exception 'series not found' using errcode = 'AG404';
  end if;

  v_to := greatest(current_date + 400, v_s.starts_on);
  if v_s.until is not null then
    v_to := least(v_to, v_s.until);
  end if;

  select coalesce(array_agg(g.d order by g.d), '{}'::date[]) into v_dates
  from private.series_dates(v_s.starts_on, v_s.freq, v_s."interval", p_cut, v_to) as g
  where not (g.d = any (v_s.excluded_on))
    and not exists (
      select 1 from public.calendar_events e
      where e.series_id = v_s.id
        and e.occurrence_on = g.d
        and not (e.id = any (v_reuse))
    );

  v_new := cardinality(v_dates);
  if v_new > 2000 then
    raise exception 'too many occurrences' using errcode = 'AG422';
  end if;

  if v_old > 0 then
    -- Park the reused rows on unique placeholder dates first, so moving them
    -- to their new dates cannot collide with each other.
    update public.calendar_events e
    set series_id = v_s.id,
        occurrence_on = date '0001-01-01' + o.n::integer,
        series_detached = false
    from unnest(v_reuse) with ordinality as o(id, n)
    where e.id = o.id;

    update public.calendar_events e
    set title = v_s.title,
        location = v_s.location,
        description = v_s.description,
        all_day = v_s.all_day,
        occurrence_on = m.d,
        starts_at = private.occurrence_starts_at(m.d, v_s.start_time, v_s.all_day, v_s.time_zone),
        ends_at = private.occurrence_ends_at(m.d, v_s.start_time, v_s.duration_minutes, v_s.all_day, v_s.time_zone)
    from (
      select o.id, nd.d
      from unnest(v_reuse) with ordinality as o(id, n)
      join unnest(v_dates) with ordinality as nd(d, n) on nd.n = o.n
    ) as m
    where e.id = m.id;

    if v_old > v_new then
      delete from public.calendar_events where id = any (v_reuse[v_new + 1 : v_old]);
    end if;
  end if;

  if v_new > v_old then
    insert into public.calendar_events (
      user_id, calendar_id, title, location, description, all_day,
      starts_at, ends_at, source, series_id, occurrence_on
    )
    select v_s.user_id, v_s.calendar_id, v_s.title, v_s.location, v_s.description, v_s.all_day,
           private.occurrence_starts_at(x.d, v_s.start_time, v_s.all_day, v_s.time_zone),
           private.occurrence_ends_at(x.d, v_s.start_time, v_s.duration_minutes, v_s.all_day, v_s.time_zone),
           'manual', v_s.id, x.d
    from unnest(v_dates[v_old + 1 : v_new]) as x(d)
    on conflict (series_id, occurrence_on) do nothing;
  end if;

  update public.calendar_event_series
  set materialized_until = greatest(coalesce(materialized_until, v_to), v_to)
  where id = v_s.id;
end;
$$;

-- ============================================================================
-- RPCs (ADR-0015 form: security invoker, search_path '', access through RLS)
-- ============================================================================

-- Creates a series and its occurrences up to today + 400 days, in one
-- transaction. Returns the id of the first occurrence. With p_event_id, an
-- existing own event of that calendar becomes the first occurrence (same id).
create function public.create_event_series(
  p_calendar_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_freq text,
  p_interval integer,
  p_location text default null,
  p_description text default null,
  p_until date default null,
  p_event_id uuid default null,
  p_time_zone text default 'Europe/Amsterdam'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind text;
  v_start_local timestamp;
  v_starts_on date;
  v_start_time time;
  v_duration integer;
  v_series uuid;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'unknown time zone' using errcode = 'AG422';
  end if;

  select c.kind into v_kind from public.calendars c where c.id = p_calendar_id;
  if v_kind is null then
    raise exception 'calendar not found' using errcode = 'AG404';
  end if;
  if v_kind <> 'manual' then
    raise exception 'calendar is read-only' using errcode = 'AG403';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.calendar_events e
    where e.id = p_event_id and e.calendar_id = p_calendar_id
      and e.source = 'manual' and e.series_id is null
  ) then
    raise exception 'event not found' using errcode = 'AG404';
  end if;

  if p_all_day then
    v_starts_on := (p_starts_at at time zone 'UTC')::date;
    v_start_time := null;
    v_duration := ((p_ends_at at time zone 'UTC')::date - v_starts_on) * 1440;
  else
    v_start_local := p_starts_at at time zone p_time_zone;
    v_starts_on := v_start_local::date;
    v_start_time := v_start_local::time;
    v_duration := (extract(epoch from ((p_ends_at at time zone p_time_zone) - v_start_local)) / 60)::integer;
  end if;

  insert into public.calendar_event_series (
    user_id, calendar_id, title, location, description, all_day, starts_on, start_time,
    duration_minutes, time_zone, freq, "interval", until
  )
  values (
    (select auth.uid()), p_calendar_id, p_title, p_location, p_description, p_all_day, v_starts_on,
    v_start_time, v_duration, p_time_zone, p_freq, p_interval, p_until
  )
  returning id into v_series;

  if p_event_id is not null then
    update public.calendar_events
    set series_id = v_series,
        occurrence_on = v_starts_on,
        series_detached = false,
        title = p_title,
        location = p_location,
        description = p_description,
        all_day = p_all_day,
        starts_at = private.occurrence_starts_at(v_starts_on, v_start_time, p_all_day, p_time_zone),
        ends_at = private.occurrence_ends_at(v_starts_on, v_start_time, v_duration, p_all_day, p_time_zone)
    where id = p_event_id;
  end if;

  perform private.fill_series(v_series, '{}'::uuid[], v_starts_on);

  return (
    select e.id from public.calendar_events e
    where e.series_id = v_series and e.occurrence_on = v_starts_on
  );
end;
$$;

-- Changes an occurrence by scope.
--   this:      the row itself, which becomes detached;
--   following: this occurrence and the later ones that are not detached are
--              refilled from the changed rule in a new series (or in the series
--              itself when this is its first occurrence), keeping their ids;
--              detached later ones move along with their own dates; the old
--              series ends the day before;
--   all:       the series and its occurrences from today on that are not
--              detached; earlier ones stay as history.
-- The rule parameters are ignored for 'this'.
create function public.update_event_series(
  p_event_id uuid,
  p_scope text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_location text default null,
  p_description text default null,
  p_freq text default null,
  p_interval integer default null,
  p_until date default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ev public.calendar_events%rowtype;
  v_s public.calendar_event_series%rowtype;
  v_start_local timestamp;
  v_old_date date;
  v_new_date date;
  v_starts_on date;
  v_start_time time;
  v_duration integer;
  v_cut date;
  v_ids uuid[];
  v_target uuid;
  v_keep boolean;
begin
  if p_scope is null or p_scope not in ('this', 'following', 'all') then
    raise exception 'invalid scope' using errcode = 'AG422';
  end if;

  select * into v_ev from public.calendar_events where id = p_event_id for update;
  if not found or v_ev.series_id is null then
    raise exception 'occurrence not found' using errcode = 'AG404';
  end if;
  select * into v_s from public.calendar_event_series where id = v_ev.series_id for update;
  if not found then
    raise exception 'occurrence not found' using errcode = 'AG404';
  end if;

  if p_scope = 'this' then
    update public.calendar_events
    set title = p_title,
        location = p_location,
        description = p_description,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        all_day = p_all_day,
        series_detached = true
    where id = p_event_id;
    return;
  end if;

  if p_freq is null or p_interval is null then
    raise exception 'rule required' using errcode = 'AG422';
  end if;

  -- The edited occurrence as a date and wall-clock time in the series' zone.
  if p_all_day then
    v_new_date := (p_starts_at at time zone 'UTC')::date;
    v_start_time := null;
    v_duration := ((p_ends_at at time zone 'UTC')::date - v_new_date) * 1440;
  else
    v_start_local := p_starts_at at time zone v_s.time_zone;
    v_new_date := v_start_local::date;
    v_start_time := v_start_local::time;
    v_duration := (extract(epoch from ((p_ends_at at time zone v_s.time_zone) - v_start_local)) / 60)::integer;
  end if;

  if p_scope = 'all' then
    v_cut := current_date;
    if v_ev.all_day then
      v_old_date := (v_ev.starts_at at time zone 'UTC')::date;
    else
      v_old_date := (v_ev.starts_at at time zone v_s.time_zone)::date;
    end if;
    -- Moving the occurrence by n days moves the whole series by n days.
    v_starts_on := v_s.starts_on + (v_new_date - v_old_date);
    v_keep := p_freq = v_s.freq and p_interval = v_s."interval" and v_starts_on = v_s.starts_on;

    if v_ev.occurrence_on < v_cut then
      -- A past occurrence is history: it takes the edit, nothing else of it moves.
      update public.calendar_events
      set title = p_title,
          location = p_location,
          description = p_description,
          starts_at = p_starts_at,
          ends_at = p_ends_at,
          all_day = p_all_day
      where id = p_event_id;
    end if;

    v_ids := array(
      select e.id from public.calendar_events e
      where e.series_id = v_s.id
        and e.occurrence_on >= v_cut
        and (not e.series_detached or e.id = p_event_id)
      order by e.occurrence_on
    );

    update public.calendar_event_series
    set title = p_title,
        location = p_location,
        description = p_description,
        all_day = p_all_day,
        starts_on = v_starts_on,
        start_time = v_start_time,
        duration_minutes = v_duration,
        freq = p_freq,
        "interval" = p_interval,
        until = p_until,
        excluded_on = case
          when v_keep then excluded_on
          else array(select x from unnest(excluded_on) as x where x < v_cut)
        end
    where id = v_s.id;

    perform private.fill_series(v_s.id, v_ids, v_cut);
    return;
  end if;

  -- following
  v_cut := v_ev.occurrence_on;
  v_keep := p_freq = v_s.freq and p_interval = v_s."interval" and v_new_date = v_cut;
  v_ids := array(
    select e.id from public.calendar_events e
    where e.series_id = v_s.id
      and e.occurrence_on >= v_cut
      and (not e.series_detached or e.id = p_event_id)
    order by e.occurrence_on
  );

  if v_cut <= v_s.starts_on then
    v_target := v_s.id;
    update public.calendar_event_series
    set title = p_title,
        location = p_location,
        description = p_description,
        all_day = p_all_day,
        starts_on = v_new_date,
        start_time = v_start_time,
        duration_minutes = v_duration,
        freq = p_freq,
        "interval" = p_interval,
        until = p_until,
        excluded_on = case when v_keep then excluded_on else '{}'::date[] end
    where id = v_s.id;
  else
    insert into public.calendar_event_series (
      user_id, calendar_id, title, location, description, all_day, starts_on, start_time,
      duration_minutes, time_zone, freq, "interval", until, excluded_on
    )
    values (
      v_s.user_id, v_s.calendar_id, p_title, p_location, p_description, p_all_day, v_new_date,
      v_start_time, v_duration, v_s.time_zone, p_freq, p_interval, p_until,
      case
        when v_keep then array(select x from unnest(v_s.excluded_on) as x where x >= v_cut)
        else '{}'::date[]
      end
    )
    returning id into v_target;

    -- Detached occurrences from here on follow into the new series with their
    -- own dates, so the new series does not generate a second row on those days.
    update public.calendar_events
    set series_id = v_target
    where series_id = v_s.id
      and occurrence_on >= v_cut
      and series_detached
      and id <> p_event_id;

    update public.calendar_event_series
    set until = v_cut - 1,
        excluded_on = array(select x from unnest(excluded_on) as x where x < v_cut),
        materialized_until = least(coalesce(materialized_until, v_cut - 1), v_cut - 1)
    where id = v_s.id;
  end if;

  perform private.fill_series(v_target, v_ids, v_new_date);
end;
$$;

-- Deletes an occurrence by scope.
--   this:      the row, remembered in excluded_on so extension does not bring it back;
--   following: this occurrence and every later one; the series ends the day before
--              (all of it goes when this is the first occurrence);
--   all:       the series with every occurrence.
create function public.delete_event_series(
  p_event_id uuid,
  p_scope text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ev public.calendar_events%rowtype;
  v_s public.calendar_event_series%rowtype;
begin
  if p_scope is null or p_scope not in ('this', 'following', 'all') then
    raise exception 'invalid scope' using errcode = 'AG422';
  end if;

  select * into v_ev from public.calendar_events where id = p_event_id for update;
  if not found or v_ev.series_id is null then
    raise exception 'occurrence not found' using errcode = 'AG404';
  end if;
  select * into v_s from public.calendar_event_series where id = v_ev.series_id for update;
  if not found then
    raise exception 'occurrence not found' using errcode = 'AG404';
  end if;

  if p_scope = 'all' or (p_scope = 'following' and v_ev.occurrence_on <= v_s.starts_on) then
    delete from public.calendar_event_series where id = v_s.id;
  elsif p_scope = 'this' then
    update public.calendar_event_series
    set excluded_on = case
          when v_ev.occurrence_on = any (excluded_on) then excluded_on
          else array_append(excluded_on, v_ev.occurrence_on)
        end
    where id = v_s.id;
    delete from public.calendar_events where id = p_event_id;
  else
    update public.calendar_event_series
    set until = v_ev.occurrence_on - 1,
        excluded_on = array(select x from unnest(excluded_on) as x where x < v_ev.occurrence_on),
        materialized_until = least(coalesce(materialized_until, v_ev.occurrence_on - 1), v_ev.occurrence_on - 1)
    where id = v_s.id;
    delete from public.calendar_events
    where series_id = v_s.id and occurrence_on >= v_ev.occurrence_on;
  end if;
end;
$$;

-- Tops up every series of the caller that holds less than 370 days of future
-- occurrences, to 400 days. Returns how many series were extended.
create function public.extend_event_series()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select s.id, coalesce(s.materialized_until + 1, s.starts_on) as cut
    from public.calendar_event_series s
    where s.user_id = (select auth.uid())
      and (s.materialized_until is null or s.materialized_until < current_date + 370)
      and (s.until is null or coalesce(s.materialized_until, s.starts_on - 1) < s.until)
    order by s.id
  loop
    perform private.fill_series(r.id, '{}'::uuid[], r.cut);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ============================================================================
-- agenda_items(): series_id for the repeat marker
-- ============================================================================

drop function public.agenda_items(timestamptz, timestamptz, text);

create function public.agenda_items(
  p_from timestamptz,
  p_to timestamptz,
  p_time_zone text default 'UTC'
)
returns table (
  kind text,
  id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  planned_on date,
  link_count integer,
  source text,
  calendar_id uuid,
  missing_since timestamptz,
  slot text,
  servings integer,
  thumbnail_path text,
  board_name text,
  column_name text,
  series_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Events: any overlap with [p_from, p_to).
  select 'event'::text, e.id, e.title, e.starts_at, e.ends_at, e.all_day,
         null::date,
         (select count(*)::integer from public.calendar_event_links l
           where l.calendar_event_id = e.id),
         e.source, e.calendar_id, e.missing_since,
         null::text, null::integer, null::text, null::text, null::text,
         e.series_id
  from public.calendar_events e
  where e.starts_at < p_to
    and (e.ends_at > p_from or e.starts_at >= p_from)

  union all

  -- Meals planned on a day.
  select 'meal'::text, m.id, r.title, null::timestamptz, null::timestamptz, true,
         m.planned_on, 0,
         null::text, m.calendar_id, null::timestamptz,
         m.slot, m.servings, r.thumbnail_path, null::text, null::text,
         null::uuid
  from public.meal_plans m
  join public.recipes r on r.id = m.recipe_id
  where m.planned_on is not null
    and (m.planned_on::timestamp at time zone p_time_zone) < p_to
    and ((m.planned_on + 1)::timestamp at time zone p_time_zone) > p_from

  union all

  -- Meals attached to an event take the event's time, so they follow it.
  select 'meal'::text, m.id, r.title, e.starts_at, e.ends_at, e.all_day,
         null::date, 0,
         null::text, m.calendar_id, null::timestamptz,
         m.slot, m.servings, r.thumbnail_path, null::text, null::text,
         null::uuid
  from public.meal_plans m
  join public.recipes r on r.id = m.recipe_id
  join public.calendar_events e on e.id = m.calendar_event_id
  where e.starts_at < p_to
    and (e.ends_at > p_from or e.starts_at >= p_from)

  union all

  -- Cards planned on a day.
  select 'planned_card'::text, c.id, c.title, null::timestamptz, null::timestamptz, true,
         c.planned_for,
         (select count(*)::integer from public.calendar_event_links l where l.card_id = c.id),
         null::text, null::uuid, null::timestamptz,
         null::text, null::integer, null::text, b.name, bc.name,
         null::uuid
  from public.cards c
  join public.board_columns bc on bc.id = c.column_id
  join public.boards b on b.id = bc.board_id
  where c.planned_for is not null
    and (c.planned_for::timestamp at time zone p_time_zone) < p_to
    and ((c.planned_for + 1)::timestamp at time zone p_time_zone) > p_from

  union all

  -- Deadlines: the local day of due_at is tested like a date-only item.
  select 'deadline'::text, c.id, c.title, c.due_at, null::timestamptz, true,
         null::date,
         (select count(*)::integer from public.calendar_event_links l where l.card_id = c.id),
         null::text, null::uuid, null::timestamptz,
         null::text, null::integer, null::text, null::text, null::text,
         null::uuid
  from public.cards c
  where c.due_at is not null
    and ((c.due_at at time zone p_time_zone)::date::timestamp at time zone p_time_zone) < p_to
    and (((c.due_at at time zone p_time_zone)::date + 1)::timestamp at time zone p_time_zone) > p_from
$$;

comment on function public.agenda_items(timestamptz, timestamptz, text) is
  'Agenda timeline over events, meal plans, planned cards and deadlines in [p_from, p_to) (ADR-0037 §1). security invoker: RLS decides what the caller sees. series_id marks an occurrence of a recurring event (ADR-0042).';

-- ============================================================================
-- Privileges: anon gets nothing; clients reach the writes through the RPCs (#304)
-- ============================================================================

revoke execute on function public.agenda_items(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.agenda_items(timestamptz, timestamptz, text) to authenticated;

revoke execute on function
  public.create_event_series(uuid, text, timestamptz, timestamptz, boolean, text, integer, text, text, date, uuid, text),
  public.update_event_series(uuid, text, text, timestamptz, timestamptz, boolean, text, text, text, integer, date),
  public.delete_event_series(uuid, text),
  public.extend_event_series()
  from public, anon;
grant execute on function
  public.create_event_series(uuid, text, timestamptz, timestamptz, boolean, text, integer, text, text, date, uuid, text),
  public.update_event_series(uuid, text, text, timestamptz, timestamptz, boolean, text, text, text, integer, date),
  public.delete_event_series(uuid, text),
  public.extend_event_series()
  to authenticated, service_role;

revoke execute on function
  private.series_dates(date, text, integer, date, date),
  private.occurrence_starts_at(date, time, boolean, text),
  private.occurrence_ends_at(date, time, integer, boolean, text),
  private.fill_series(uuid, uuid[], date)
  from public, anon;
grant execute on function
  private.series_dates(date, text, integer, date, date),
  private.occurrence_starts_at(date, time, boolean, text),
  private.occurrence_ends_at(date, time, integer, boolean, text),
  private.fill_series(uuid, uuid[], date)
  to authenticated, service_role;

revoke execute on function private.calendar_event_series_set_owner()
  from public, anon, authenticated;
