-- #484 (epic #33, ADR-0037 §1): one timeline query over all agenda sources.
--
-- security invoker, so RLS applies on every branch: the caller sees only the
-- events, meal plans and cards they can read. Additive only (ADR-0032 §5). Not
-- applied to hosted by merging: needs the user's explicit go.
--
-- Rows carry raw data; lib/agenda maps them to the UI union. Date-only items
-- (planned meals, planned cards) use planned_on; timed and all-day events and
-- deadlines use starts_at/ends_at. p_time_zone decides which local day a
-- date-only item or a deadline occupies for the range test.
--
-- There is no "done column" notion on board_columns, so every card with a
-- due_at is returned as a deadline.

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
  column_name text
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
         null::text, null::integer, null::text, null::text, null::text
  from public.calendar_events e
  where e.starts_at < p_to
    and (e.ends_at > p_from or e.starts_at >= p_from)

  union all

  -- Meals planned on a day.
  select 'meal'::text, m.id, r.title, null::timestamptz, null::timestamptz, true,
         m.planned_on, 0,
         null::text, m.calendar_id, null::timestamptz,
         m.slot, m.servings, r.thumbnail_path, null::text, null::text
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
         m.slot, m.servings, r.thumbnail_path, null::text, null::text
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
         null::text, null::integer, null::text, b.name, bc.name
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
         null::text, null::integer, null::text, null::text, null::text
  from public.cards c
  where c.due_at is not null
    and ((c.due_at at time zone p_time_zone)::date::timestamp at time zone p_time_zone) < p_to
    and (((c.due_at at time zone p_time_zone)::date + 1)::timestamp at time zone p_time_zone) > p_from
$$;

comment on function public.agenda_items(timestamptz, timestamptz, text) is
  'Agenda timeline over events, meal plans, planned cards and deadlines in [p_from, p_to) (ADR-0037 §1). security invoker: RLS decides what the caller sees.';

revoke execute on function public.agenda_items(timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.agenda_items(timestamptz, timestamptz, text)
  to authenticated;
