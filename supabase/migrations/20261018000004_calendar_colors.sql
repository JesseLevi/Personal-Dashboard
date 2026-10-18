-- #532 (epic #527, ADR-0040): categories are calendars with a colour.
--   calendars.color (nine palette keys) with its backfill, update grant and a
--   default for new calendars, the grants that let a calendar's contents move,
--   and the two RPCs behind the UI: delete_calendar_moving_contents and
--   move_event_calendar.
--
-- Additive only (ADR-0032 §5). Not applied to hosted by merging: needs the
-- user's explicit go.
--
-- Errors from the RPCs carry the custom SQLSTATEs of 20261018000003:
--   AG404 not found (or not visible to the caller), AG403 not allowed (the
--   default calendar, an imported calendar or event), AG422 invalid input.

-- ============================================================================
-- The next colour for a new calendar
-- ============================================================================

-- The first palette colour the user's calendars use least: an unused one while
-- there is one, else the least used. security invoker: a caller counts only
-- the calendars RLS shows them, which are their own. Volatile on purpose: a
-- stable function would not see calendars inserted earlier by the same statement.
create function private.next_calendar_color(p_user_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select p.color
  from unnest(array['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'stone'])
         with ordinality as p(color, ord)
  order by (select count(*) from public.calendars c where c.user_id = p_user_id and c.color = p.color),
           p.ord
  limit 1
$$;

revoke execute on function private.next_calendar_color(uuid) from public, anon;
grant execute on function private.next_calendar_color(uuid) to authenticated, service_role;

-- ============================================================================
-- calendars.color
-- ============================================================================

alter table public.calendars add column color text;

-- The default calendar starts blue, imported calendars violet, other own
-- calendars take the first colour their owner does not use yet.
update public.calendars set color = 'blue' where is_default;
update public.calendars set color = 'violet' where kind <> 'manual' and color is null;

do $$
declare
  r record;
begin
  for r in
    select id, user_id from public.calendars where color is null order by user_id, created_at, id
  loop
    update public.calendars set color = private.next_calendar_color(r.user_id) where id = r.id;
  end loop;
end;
$$;

alter table public.calendars
  alter column color set not null,
  add constraint calendars_color_check
    check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'stone'));

comment on column public.calendars.color is
  'Palette key (ADR-0040): red, orange, amber, green, teal, blue, violet, pink or stone. Every event of the calendar takes it. A new calendar without a colour gets the first one its owner uses least (calendars_default_color).';

-- A client or definer function that inserts a calendar without a colour gets
-- the next free one.
create function private.calendars_default_color()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.color is null then
    new.color := private.next_calendar_color(new.user_id);
  end if;
  return new;
end;
$$;

create trigger calendars_default_color
  before insert on public.calendars
  for each row execute function private.calendars_default_color();

revoke execute on function private.calendars_default_color() from public, anon, authenticated;

-- The default calendar is blue (ADR-0040 §2); everything else is picked by the trigger.
create or replace function public.seed_calendars_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.calendars (user_id, kind, is_default, position, color)
  values (p_user_id, 'manual', true, 1000, 'blue')
  on conflict (user_id) where is_default do nothing;
end;
$$;

-- ============================================================================
-- Grants
-- ============================================================================

grant update (color) on public.calendars to authenticated;

-- A calendar's contents move with a calendar change. The policies still decide
-- who may write (the owner of both the old and the new calendar), and the
-- series and meal checks keep an occurrence in its series' calendar.
grant update (calendar_id) on public.calendar_event_series to authenticated;
grant update (calendar_id) on public.meal_plans to authenticated;

-- ============================================================================
-- delete_calendar_moving_contents
-- ============================================================================

-- Moves the manual events, event series and meal plans of an own calendar to
-- the owner's default calendar, then deletes the calendar. Links stay on their
-- events. The default calendar and imported calendars are refused.
create function public.delete_calendar_moving_contents(p_calendar_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cal public.calendars%rowtype;
  v_default uuid;
begin
  select * into v_cal from public.calendars where id = p_calendar_id for update;
  if not found then
    raise exception 'calendar not found' using errcode = 'AG404';
  end if;
  if v_cal.is_default or v_cal.kind <> 'manual' then
    raise exception 'calendar cannot be deleted this way' using errcode = 'AG403';
  end if;

  select c.id into v_default
  from public.calendars c
  where c.user_id = v_cal.user_id and c.is_default;
  if v_default is null then
    raise exception 'default calendar not found' using errcode = 'AG404';
  end if;

  -- Series first: an occurrence may only point at a series of its own calendar.
  update public.calendar_event_series set calendar_id = v_default where calendar_id = p_calendar_id;
  update public.calendar_events set calendar_id = v_default where calendar_id = p_calendar_id;
  -- Meal plans after the events they may be attached to, for the same reason.
  update public.meal_plans set calendar_id = v_default where calendar_id = p_calendar_id;

  delete from public.calendars where id = p_calendar_id;
end;
$$;

comment on function public.delete_calendar_moving_contents(uuid) is
  'Deletes an own manual calendar after moving its events, event series and meal plans to the default calendar (ADR-0040 §5). Refuses the default calendar and imported calendars (AG403). security invoker: RLS decides what the caller may touch.';

-- ============================================================================
-- move_event_calendar
-- ============================================================================

-- Gives an own event another manual calendar (the event panel's category).
--   single event: the event moves;
--   this:         the occurrence leaves its series (the date joins excluded_on,
--                 so extension does not bring it back) and moves as a single event;
--   following:    this occurrence and the later ones move into a new series of
--                 the new calendar, keeping their ids; the old series ends the
--                 day before (the whole series moves on its first occurrence);
--   all:          the series and every occurrence move.
-- Meal plans attached to a moved event follow it.
create function public.move_event_calendar(
  p_event_id uuid,
  p_calendar_id uuid,
  p_scope text default 'all'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ev public.calendar_events%rowtype;
  v_s public.calendar_event_series%rowtype;
  v_kind text;
  v_cut date;
  v_new uuid;
begin
  if p_scope is null or p_scope not in ('this', 'following', 'all') then
    raise exception 'invalid scope' using errcode = 'AG422';
  end if;

  select * into v_ev from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'AG404';
  end if;
  if v_ev.source <> 'manual' then
    raise exception 'event is read-only' using errcode = 'AG403';
  end if;

  select c.kind into v_kind from public.calendars c where c.id = p_calendar_id;
  if v_kind is null then
    raise exception 'calendar not found' using errcode = 'AG404';
  end if;
  if v_kind <> 'manual' then
    raise exception 'calendar is read-only' using errcode = 'AG403';
  end if;

  if v_ev.calendar_id = p_calendar_id then
    return;
  end if;

  if v_ev.series_id is null then
    update public.calendar_events set calendar_id = p_calendar_id where id = p_event_id;
  else
    select * into v_s from public.calendar_event_series where id = v_ev.series_id for update;
    if not found then
      raise exception 'series not found' using errcode = 'AG404';
    end if;

    if p_scope = 'this' then
      update public.calendar_event_series
      set excluded_on = case
            when v_ev.occurrence_on = any (excluded_on) then excluded_on
            else array_append(excluded_on, v_ev.occurrence_on)
          end
      where id = v_s.id;
      update public.calendar_events
      set series_id = null,
          occurrence_on = null,
          series_detached = false,
          calendar_id = p_calendar_id
      where id = p_event_id;
    elsif p_scope = 'all' or v_ev.occurrence_on <= v_s.starts_on then
      update public.calendar_event_series set calendar_id = p_calendar_id where id = v_s.id;
      update public.calendar_events set calendar_id = p_calendar_id where series_id = v_s.id;
    else
      v_cut := v_ev.occurrence_on;
      insert into public.calendar_event_series (
        user_id, calendar_id, title, location, description, all_day, starts_on, start_time,
        duration_minutes, time_zone, freq, "interval", until, excluded_on, materialized_until
      )
      values (
        v_s.user_id, p_calendar_id, v_s.title, v_s.location, v_s.description, v_s.all_day, v_cut,
        v_s.start_time, v_s.duration_minutes, v_s.time_zone, v_s.freq, v_s."interval", v_s.until,
        array(select x from unnest(v_s.excluded_on) as x where x >= v_cut),
        v_s.materialized_until
      )
      returning id into v_new;

      update public.calendar_event_series
      set until = v_cut - 1,
          excluded_on = array(select x from unnest(excluded_on) as x where x < v_cut),
          materialized_until = least(coalesce(materialized_until, v_cut - 1), v_cut - 1)
      where id = v_s.id;

      update public.calendar_events
      set series_id = v_new,
          calendar_id = p_calendar_id
      where series_id = v_s.id
        and occurrence_on >= v_cut;
    end if;
  end if;

  update public.meal_plans m
  set calendar_id = p_calendar_id
  from public.calendar_events e
  where e.id = m.calendar_event_id
    and e.calendar_id = p_calendar_id
    and m.calendar_id <> p_calendar_id;
end;
$$;

comment on function public.move_event_calendar(uuid, uuid, text) is
  'Moves an own event, or the occurrences of a series chosen by scope (this, following, all; ADR-0042), to another manual calendar; attached meal plans follow. Refuses imported events and calendars (AG403). security invoker.';

-- ============================================================================
-- Privileges (#304): clients reach the writes only through these RPCs
-- ============================================================================

revoke execute on function
  public.delete_calendar_moving_contents(uuid),
  public.move_event_calendar(uuid, uuid, text)
  from public, anon;
grant execute on function
  public.delete_calendar_moving_contents(uuid),
  public.move_event_calendar(uuid, uuid, text)
  to authenticated;
