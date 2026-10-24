-- #582 (ADR-0044): public.activity_events, an append-only log of what is added
-- to and ticked off in a basket and which planned meals were cooked. Written
-- only by definer functions; the owner reads and deletes their own rows.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('basket_item_added', 'basket_item_checked', 'recipe_cooked')),
  occurred_at timestamptz not null default now(),
  item_key text,
  item_name text,
  quantity numeric,
  unit public.recipe_unit,
  shopping_list_id uuid references public.shopping_lists (id) on delete set null,
  shopping_list_item_id uuid references public.shopping_list_items (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  check (kind = 'recipe_cooked' or item_key is not null)
);

comment on table public.activity_events is
  'Append-only history (ADR-0044). user_id is the owner of the basket or meal plan; there is no actor column. Written by definer functions only.';

create unique index activity_events_recipe_cooked_meal_plan_key
  on public.activity_events (meal_plan_id) where kind = 'recipe_cooked';
create index activity_events_item_idx on public.activity_events (user_id, kind, item_key, occurred_at);
create index activity_events_recipe_idx on public.activity_events (user_id, kind, recipe_id, occurred_at);
create index activity_events_item_id_idx on public.activity_events (shopping_list_item_id);

alter table public.activity_events enable row level security;

create policy activity_events_select_own on public.activity_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy activity_events_delete_own on public.activity_events
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.activity_events from anon, authenticated;
grant select, delete on public.activity_events to authenticated;

-- ============================================================================
-- item_key: lower case, trimmed, whitespace collapsed
-- ============================================================================

create function private.activity_item_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.lower(pg_catalog.btrim(pg_catalog.regexp_replace(p_name, '\s+', ' ', 'g')))
$$;

revoke execute on function private.activity_item_key(text) from public, anon, authenticated;

-- ============================================================================
-- Cooked meals: one recipe_cooked per meal plan whose day has passed
-- ============================================================================

create function private.settle_cooked_meals(p_user uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.activity_events (user_id, kind, occurred_at, recipe_id, meal_plan_id)
  select m.user_id, 'recipe_cooked',
         coalesce(e.starts_at, (m.planned_on + time '12:00') at time zone 'Europe/Amsterdam'),
         m.recipe_id, m.id
  from public.meal_plans m
  left join public.calendar_events e on e.id = m.calendar_event_id
  where m.user_id = p_user
    and coalesce((e.starts_at at time zone 'Europe/Amsterdam')::date, m.planned_on)
        < (pg_catalog.now() at time zone 'Europe/Amsterdam')::date
  on conflict (meal_plan_id) where kind = 'recipe_cooked' do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.settle_cooked_meals()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then 0
              else private.settle_cooked_meals((select auth.uid())) end
$$;

create function public.settle_cooked_meals_for(p_user uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select private.settle_cooked_meals(p_user)
$$;

comment on function public.settle_cooked_meals is
  'Writes recipe_cooked for the caller''s past meal plans; idempotent (ADR-0044 §3).';
comment on function public.settle_cooked_meals_for is
  'Same for one member, for the cron route. service_role only (ADR-0044 §3).';

revoke execute on function private.settle_cooked_meals(uuid) from public, anon, authenticated;
revoke execute on function public.settle_cooked_meals() from public, anon;
grant execute on function public.settle_cooked_meals() to authenticated;
revoke execute on function public.settle_cooked_meals_for(uuid) from public, anon, authenticated;
grant execute on function public.settle_cooked_meals_for(uuid) to service_role;

-- ============================================================================
-- Backfill (ADR-0044 §5), before the triggers exist
-- ============================================================================

insert into public.activity_events
  (user_id, kind, occurred_at, item_key, item_name, quantity, unit,
   shopping_list_id, shopping_list_item_id, recipe_id)
select i.user_id, 'basket_item_added', i.created_at, private.activity_item_key(i.name), i.name,
       i.quantity, i.unit, i.list_id, i.id, i.recipe_id
from public.shopping_list_items i;

insert into public.activity_events
  (user_id, kind, occurred_at, item_key, item_name, quantity, unit,
   shopping_list_id, shopping_list_item_id, recipe_id)
select i.user_id, 'basket_item_checked', i.updated_at, private.activity_item_key(i.name), i.name,
       i.quantity, i.unit, i.list_id, i.id, i.recipe_id
from public.shopping_list_items i
where i.checked;

select private.settle_cooked_meals(u.user_id)
from (select distinct user_id from public.meal_plans) u;

-- ============================================================================
-- Triggers on shopping_list_items
-- ============================================================================

create function private.shopping_list_items_log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_events
      (user_id, kind, item_key, item_name, quantity, unit, shopping_list_id, shopping_list_item_id, recipe_id)
    values (new.user_id, 'basket_item_added', private.activity_item_key(new.name), new.name,
            new.quantity, new.unit, new.list_id, new.id, new.recipe_id);
  elsif new.checked and not old.checked then
    insert into public.activity_events
      (user_id, kind, item_key, item_name, quantity, unit, shopping_list_id, shopping_list_item_id, recipe_id)
    values (new.user_id, 'basket_item_checked', private.activity_item_key(new.name), new.name,
            new.quantity, new.unit, new.list_id, new.id, new.recipe_id);
  elsif old.checked and not new.checked then
    delete from public.activity_events
    where id = (
      select e.id from public.activity_events e
      where e.shopping_list_item_id = new.id and e.kind = 'basket_item_checked'
      order by e.occurred_at desc, e.id desc
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger shopping_list_items_log_insert
  after insert on public.shopping_list_items
  for each row execute function private.shopping_list_items_log_activity();
create trigger shopping_list_items_log_checked
  after update of checked on public.shopping_list_items
  for each row when (old.checked is distinct from new.checked)
  execute function private.shopping_list_items_log_activity();

revoke execute on function private.shopping_list_items_log_activity() from public, anon, authenticated;
