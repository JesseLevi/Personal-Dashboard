-- "Done" columns (ADR-0050).
--   board_columns.is_done   cards in such a column are finished
--   agenda_items()          leaves finished cards out (planned and deadline);
--                           same signature, so widget_today() follows
--   seed_board_for()        the default "Afgerond" column is a done column
--
-- Apply after 20261030000001_widget_tokens and 20261102000001_card_subtasks. Not applied to hosted by merging:
-- needs the user's explicit go.

alter table public.board_columns
  add column is_done boolean not null default false;

comment on column public.board_columns.is_done is
  'Cards in this column are finished: off the Agenda, the widget and the plan drawer (ADR-0050).';

update public.board_columns
set is_done = true
where name = 'Afgerond' or icon = 'CircleCheck';

create or replace function public.seed_board_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
begin
  if exists (select 1 from public.boards where user_id = p_user_id) then
    return;
  end if;

  insert into public.boards (user_id, name, position, is_favorite)
  values (p_user_id, 'Te doen', 1000, true)
  returning id into new_board_id;

  insert into public.board_columns (user_id, board_id, name, icon, position, is_done)
  values
    (p_user_id, new_board_id, 'Ideeën', 'Lightbulb', 1000, false),
    (p_user_id, new_board_id, 'Klaar', 'AlarmClockCheck', 2000, false),
    (p_user_id, new_board_id, 'Bezig', 'Loader', 3000, false),
    (p_user_id, new_board_id, 'Afgerond', 'CircleCheck', 4000, true);
end;
$$;

create or replace function public.agenda_items(
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
    and not bc.is_done
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
  join public.board_columns bc on bc.id = c.column_id
  where c.due_at is not null
    and not bc.is_done
    and ((c.due_at at time zone p_time_zone)::date::timestamp at time zone p_time_zone) < p_to
    and (((c.due_at at time zone p_time_zone)::date + 1)::timestamp at time zone p_time_zone) > p_from
$$;

comment on function public.agenda_items(timestamptz, timestamptz, text) is
  'Agenda timeline over events, meal plans, planned cards and deadlines in [p_from, p_to) (ADR-0037 §1). security invoker: RLS decides what the caller sees. series_id marks an occurrence of a recurring event (ADR-0042). Cards in a done column are left out (ADR-0050).';
