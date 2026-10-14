-- #483 (epic #33, ADR-0037): the Agenda schema.
--   calendars (container, ADR-0035), calendar_accounts, calendar_events,
--   meal_plans, calendar_event_links, cards.planned_for and
--   shopping_list_items.meal_plan_id, plus the default-calendar seed.
--
-- Additive only (ADR-0032 §5). Not applied to hosted by merging: needs the
-- user's explicit go.

-- ============================================================================
-- calendar_accounts: one per external feed. Secrets live in Vault (ADR-0002);
-- vault_secret_id is only a reference and is written by trusted code, never
-- by a client.
-- ============================================================================

create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('ics', 'caldav', 'graph', 'google')),
  display_name text not null,
  vault_secret_id uuid,
  sync_state jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.calendar_accounts is
  'External calendar connection (ADR-0037). Secret URLs and tokens are stored only in Vault (ADR-0002), referenced by vault_secret_id; never in a column. Deleting an account cascades its calendars and synced events.';

create index calendar_accounts_user_id_idx on public.calendar_accounts (user_id);

create trigger calendar_accounts_set_updated_at
  before update on public.calendar_accounts
  for each row execute function public.set_updated_at();

alter table public.calendar_accounts enable row level security;

create policy calendar_accounts_select_own on public.calendar_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_accounts_insert_own on public.calendar_accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy calendar_accounts_update_own on public.calendar_accounts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy calendar_accounts_delete_own on public.calendar_accounts
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.calendar_accounts from anon, authenticated;
grant select, delete on public.calendar_accounts to authenticated;
grant insert (user_id, provider, display_name) on public.calendar_accounts to authenticated;
grant update (display_name) on public.calendar_accounts to authenticated;
grant select, insert, update, delete on public.calendar_accounts to service_role;

-- ============================================================================
-- calendars (container)
-- ============================================================================

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- null = the translated default name ("Agenda" / "Calendar").
  name text,
  kind text not null default 'manual'
    check (kind in ('manual', 'ics', 'caldav', 'graph', 'google')),
  calendar_account_id uuid references public.calendar_accounts (id) on delete cascade,
  is_default boolean not null default false,
  position numeric not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'manual') = (calendar_account_id is null)),
  check (not is_default or kind = 'manual')
);

comment on table public.calendars is
  'Calendar container (ADR-0035, ADR-0037). user_id is the owner. Exactly one is_default row per user, seeded through ADR-0017; it cannot be deleted. Imported feeds are their own calendar, tied to a calendar_accounts row.';

create unique index calendars_one_default_per_user
  on public.calendars (user_id) where is_default;
create index calendars_user_id_idx on public.calendars (user_id);
create index calendars_calendar_account_id_idx on public.calendars (calendar_account_id);

create trigger calendars_set_updated_at
  before update on public.calendars
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Access function (ADR-0035 shape; owner only until sharing lands)
-- ============================================================================

create function private.calendar_role(p_calendar_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.user_id = (select auth.uid()) then 'owner'
  end
  from public.calendars c
  where c.id = p_calendar_id
$$;

revoke execute on function private.calendar_role(uuid) from public, anon;
grant execute on function private.calendar_role(uuid) to authenticated;

alter table public.calendars enable row level security;

create policy calendars_select_member on public.calendars
  for select to authenticated
  using (private.calendar_role(id) in ('owner', 'editor'));
-- A client can only create non-default calendars, and only against an account
-- of their own; defaults come from the security definer seed.
create policy calendars_insert_own on public.calendars
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not is_default
    and (
      calendar_account_id is null
      or exists (
        select 1 from public.calendar_accounts a
        where a.id = calendar_account_id and a.user_id = (select auth.uid())
      )
    )
  );
create policy calendars_update_own on public.calendars
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy calendars_delete_own on public.calendars
  for delete to authenticated
  using (user_id = (select auth.uid()) and not is_default);

revoke all on public.calendars from anon, authenticated;
grant select, insert, delete on public.calendars to authenticated;
-- is_default, kind, user_id and calendar_account_id are immutable for clients.
grant update (name, position, updated_at) on public.calendars to authenticated;
grant select, insert, update, delete on public.calendars to service_role;

-- ============================================================================
-- calendar_events
-- ============================================================================

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  -- Always the calendar owner's id; set by the BEFORE trigger below.
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  description text check (description is null or char_length(description) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'sync')),
  calendar_account_id uuid references public.calendar_accounts (id) on delete cascade,
  external_id text,
  content_hash text,
  missing_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (
    (source = 'sync' and calendar_account_id is not null and external_id is not null)
    or (source = 'manual' and calendar_account_id is null and external_id is null)
  ),
  unique (calendar_account_id, external_id)
);

comment on table public.calendar_events is
  'Calendar events (ADR-0037). source = manual rows are fully editable; source = sync rows are written only by the sync code (service_role) and their source fields are read-only for clients (ADR-0005). The sync upserts on (calendar_account_id, external_id) so links survive.';

create index calendar_events_calendar_id_starts_at_idx
  on public.calendar_events (calendar_id, starts_at);
create index calendar_events_user_id_idx on public.calendar_events (user_id);

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

create function private.calendar_events_set_owner()
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

create trigger calendar_events_set_owner
  before insert or update of calendar_id, user_id on public.calendar_events
  for each row execute function private.calendar_events_set_owner();

-- Source fields of a synced row are read-only for clients. Trusted code
-- (service_role, the migration owner) is not restricted.
create function private.calendar_events_protect_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and old.source = 'sync'
     and (
       new.calendar_id is distinct from old.calendar_id
       or new.title is distinct from old.title
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.all_day is distinct from old.all_day
       or new.location is distinct from old.location
       or new.description is distinct from old.description
     ) then
    raise exception 'synced calendar events are read-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger calendar_events_protect_sync
  before update on public.calendar_events
  for each row execute function private.calendar_events_protect_sync();

create function private.calendar_event_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.calendar_role(e.calendar_id)
  from public.calendar_events e
  where e.id = p_event_id
$$;

revoke execute on function private.calendar_event_role(uuid) from public, anon;
grant execute on function private.calendar_event_role(uuid) to authenticated;

alter table public.calendar_events enable row level security;

create policy calendar_events_select_member on public.calendar_events
  for select to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy calendar_events_insert_member on public.calendar_events
  for insert to authenticated
  with check (
    private.calendar_role(calendar_id) in ('owner', 'editor')
    and source = 'manual'
  );
create policy calendar_events_update_member on public.calendar_events
  for update to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'))
  with check (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy calendar_events_delete_member on public.calendar_events
  for delete to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));

revoke all on public.calendar_events from anon, authenticated;
grant select, insert, delete on public.calendar_events to authenticated;
-- source, calendar_account_id, external_id, content_hash and missing_since
-- are written by the sync only.
grant update (calendar_id, title, starts_at, ends_at, all_day, location, description, updated_at)
  on public.calendar_events to authenticated;
grant select, insert, update, delete on public.calendar_events to service_role;

-- ============================================================================
-- meal_plans
-- ============================================================================

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings integer not null check (servings > 0),
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  planned_on date,
  calendar_event_id uuid references public.calendar_events (id) on delete cascade,
  -- Order within a day and slot.
  position numeric not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(planned_on, calendar_event_id) = 1)
);

comment on table public.meal_plans is
  'A recipe planned on a day (planned_on) or attached to an event (calendar_event_id), exactly one of the two (ADR-0037). An attached plan takes its date from the event at query time.';

create index meal_plans_calendar_id_planned_on_idx on public.meal_plans (calendar_id, planned_on);
create index meal_plans_calendar_event_id_idx on public.meal_plans (calendar_event_id);
create index meal_plans_recipe_id_idx on public.meal_plans (recipe_id);
create index meal_plans_user_id_idx on public.meal_plans (user_id);

create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

create function private.meal_plans_set_owner()
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

create trigger meal_plans_set_owner
  before insert or update of calendar_id, user_id on public.meal_plans
  for each row execute function private.meal_plans_set_owner();

alter table public.meal_plans enable row level security;

-- Inserts and updates must point at a recipe the caller can read and, for an
-- attached plan, at an event of the same calendar.
create policy meal_plans_select_member on public.meal_plans
  for select to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));
create policy meal_plans_insert_member on public.meal_plans
  for insert to authenticated
  with check (
    private.calendar_role(calendar_id) in ('owner', 'editor')
    and exists (select 1 from public.recipes r where r.id = recipe_id)
    and (
      calendar_event_id is null
      or exists (
        select 1 from public.calendar_events e
        where e.id = calendar_event_id and e.calendar_id = meal_plans.calendar_id
      )
    )
  );
create policy meal_plans_update_member on public.meal_plans
  for update to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'))
  with check (
    private.calendar_role(calendar_id) in ('owner', 'editor')
    and (
      calendar_event_id is null
      or exists (
        select 1 from public.calendar_events e
        where e.id = calendar_event_id and e.calendar_id = meal_plans.calendar_id
      )
    )
  );
create policy meal_plans_delete_member on public.meal_plans
  for delete to authenticated
  using (private.calendar_role(calendar_id) in ('owner', 'editor'));

revoke all on public.meal_plans from anon, authenticated;
grant select, insert, delete on public.meal_plans to authenticated;
grant update (servings, slot, planned_on, calendar_event_id, position, updated_at)
  on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plans to service_role;

-- ============================================================================
-- calendar_event_links (exclusive arc: card, recipe or note)
-- ============================================================================

create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(card_id, recipe_id, note_id) = 1),
  unique (calendar_event_id, card_id),
  unique (calendar_event_id, recipe_id),
  unique (calendar_event_id, note_id)
);

comment on table public.calendar_event_links is
  'Atlas-owned links from any event, imported ones included, to one card, recipe or note (ADR-0037). RLS requires that the caller can read both ends. Deleting an event removes its links; the linked card, recipe or note is never deleted by it.';

create index calendar_event_links_card_id_idx on public.calendar_event_links (card_id);
create index calendar_event_links_recipe_id_idx on public.calendar_event_links (recipe_id);
create index calendar_event_links_note_id_idx on public.calendar_event_links (note_id);
create index calendar_event_links_user_id_idx on public.calendar_event_links (user_id);

create function private.calendar_event_links_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select c.user_id into v_owner
  from public.calendar_events e
  join public.calendars c on c.id = e.calendar_id
  where e.id = new.calendar_event_id;
  if v_owner is null then
    raise exception 'unknown calendar event' using errcode = '23503';
  end if;
  new.user_id := v_owner;
  return new;
end;
$$;

create trigger calendar_event_links_set_owner
  before insert or update of calendar_event_id, user_id on public.calendar_event_links
  for each row execute function private.calendar_event_links_set_owner();

alter table public.calendar_event_links enable row level security;

-- Subqueries on cards, recipes and notes run under the caller's RLS, so a
-- link is only visible or creatable when both ends are readable.
create policy calendar_event_links_select_member on public.calendar_event_links
  for select to authenticated
  using (
    private.calendar_event_role(calendar_event_id) in ('owner', 'editor')
    and (card_id is null or exists (select 1 from public.cards c where c.id = card_id))
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = recipe_id))
    and (note_id is null or exists (select 1 from public.notes n where n.id = note_id))
  );
create policy calendar_event_links_insert_member on public.calendar_event_links
  for insert to authenticated
  with check (
    private.calendar_event_role(calendar_event_id) in ('owner', 'editor')
    and (card_id is null or exists (select 1 from public.cards c where c.id = card_id))
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = recipe_id))
    and (note_id is null or exists (select 1 from public.notes n where n.id = note_id))
  );
-- A link has no editable column; the policy keeps the standard four in place.
create policy calendar_event_links_update_member on public.calendar_event_links
  for update to authenticated
  using (private.calendar_event_role(calendar_event_id) in ('owner', 'editor'))
  with check (private.calendar_event_role(calendar_event_id) in ('owner', 'editor'));
create policy calendar_event_links_delete_member on public.calendar_event_links
  for delete to authenticated
  using (private.calendar_event_role(calendar_event_id) in ('owner', 'editor'));

revoke all on public.calendar_event_links from anon, authenticated;
grant select, insert, delete on public.calendar_event_links to authenticated;
grant select, insert, update, delete on public.calendar_event_links to service_role;

-- ============================================================================
-- Planning columns on existing tables
-- ============================================================================

-- The day the user intends to do a card, separate from the deadline due_at.
alter table public.cards add column planned_for date;

alter table public.shopping_list_items
  add column meal_plan_id uuid references public.meal_plans (id) on delete set null;

create index shopping_list_items_meal_plan_id_idx
  on public.shopping_list_items (meal_plan_id);

-- ============================================================================
-- Seed (ADR-0017): the default calendar
-- ============================================================================

create function public.seed_calendars_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.calendars (user_id, kind, is_default, position)
  values (p_user_id, 'manual', true, 1000)
  on conflict (user_id) where is_default do nothing;
end;
$$;

create or replace function public.seed_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['default_board', 'default_recipe_categories', 'default_note_categories',
               'default_shopping_list', 'default_calendar']
$$;

create or replace function public.apply_seed(p_user_id uuid, p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if not (p_key = any (public.seed_keys())) then
    raise exception 'unknown seed key %', p_key;
  end if;

  insert into public.user_seeds (user_id, seed_key)
  values (p_user_id, p_key)
  on conflict (user_id, seed_key) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return false;
  end if;

  case p_key
    when 'default_board' then perform public.seed_board_for(p_user_id);
    when 'default_recipe_categories' then perform public.seed_recipe_categories_for(p_user_id);
    when 'default_note_categories' then perform public.seed_note_categories_for(p_user_id);
    when 'default_shopping_list' then perform public.seed_shopping_lists_for(p_user_id);
    when 'default_calendar' then perform public.seed_calendars_for(p_user_id);
  end case;
  return true;
end;
$$;

create function public.seed_default_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_seed(new.id, 'default_calendar');
  return new;
end;
$$;

create trigger on_auth_user_created_seed_calendar
  after insert on auth.users
  for each row execute function public.seed_default_calendar();

-- ============================================================================
-- Privileges: nothing here is callable by clients (#304)
-- ============================================================================

revoke execute on function
  private.calendar_events_set_owner(),
  private.calendar_events_protect_sync(),
  private.meal_plans_set_owner(),
  private.calendar_event_links_set_owner(),
  public.seed_calendars_for(uuid),
  public.seed_default_calendar(),
  public.apply_seed(uuid, text),
  public.seed_keys()
  from public, anon, authenticated;
