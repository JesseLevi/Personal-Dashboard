-- #422 (epic #420, ADR-0035 §2/§10): public.shopping_lists, the container a
-- basket's items hang off. Nothing is shared yet (shares comes in #423).
--
-- Additive on purpose (ADR-0032 §5): the code deployed today inserts and reads
-- shopping_list_items without a list_id, and keeps working against this schema
-- until promotion. A BEFORE INSERT trigger fills a missing list_id with the
-- owner's default list (creating it when the owner has none yet) and always
-- sets items.user_id to the list's owner. Old reads and deletes filter on
-- user_id, which stays correct.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- ============================================================================
-- shopping_lists
-- ============================================================================

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- null = the translated default name ("Mijn mand" / "My basket").
  name text,
  is_default boolean not null default false,
  position numeric not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_lists is
  'Basket container (ADR-0035). user_id is the owner. Exactly one is_default '
  'row per user, seeded through ADR-0017; it cannot be deleted.';

create unique index shopping_lists_one_default_per_user
  on public.shopping_lists (user_id) where is_default;
create index shopping_lists_user_id_idx on public.shopping_lists (user_id);

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

alter table public.shopping_lists enable row level security;

create policy shopping_lists_select_own on public.shopping_lists
  for select using (user_id = (select auth.uid()));
-- A client can only create non-default baskets; defaults come from the
-- security definer seed.
create policy shopping_lists_insert_own on public.shopping_lists
  for insert with check (user_id = (select auth.uid()) and not is_default);
create policy shopping_lists_update_own on public.shopping_lists
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy shopping_lists_delete_own on public.shopping_lists
  for delete using (user_id = (select auth.uid()) and not is_default);

grant select, insert, delete on public.shopping_lists to authenticated;
-- is_default and user_id are immutable for clients.
grant update (name, position, updated_at) on public.shopping_lists to authenticated;
grant select on public.shopping_lists to anon;
grant select, insert, update, delete on public.shopping_lists to service_role;

-- ============================================================================
-- shopping_list_items.list_id: add nullable, backfill, then not null
-- ============================================================================

alter table public.shopping_list_items
  add column list_id uuid references public.shopping_lists (id) on delete cascade;

insert into public.shopping_lists (user_id, is_default, position)
select u.user_id, true, 1000
from (
  select user_id from public.shopping_list_items
  union
  select id from public.profiles
) u
on conflict (user_id) where is_default do nothing;

-- Keep updated_at untouched by the backfill.
alter table public.shopping_list_items disable trigger shopping_list_items_set_updated_at;
update public.shopping_list_items i
set list_id = l.id
from public.shopping_lists l
where l.user_id = i.user_id and l.is_default and i.list_id is null;
alter table public.shopping_list_items enable trigger shopping_list_items_set_updated_at;

alter table public.shopping_list_items alter column list_id set not null;

create index shopping_list_items_list_id_idx on public.shopping_list_items (list_id);

-- ============================================================================
-- Items follow their list: list_id default + user_id = list owner
-- ============================================================================

create function public.shopping_list_items_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.list_id is null then
    select id into new.list_id from public.shopping_lists
      where user_id = new.user_id and is_default;
    if new.list_id is null and new.user_id = (select auth.uid()) then
      insert into public.shopping_lists (user_id, is_default, position)
      values (new.user_id, true, 1000)
      on conflict (user_id) where is_default do nothing;
      select id into new.list_id from public.shopping_lists
        where user_id = new.user_id and is_default;
    end if;
  end if;

  select user_id into v_owner from public.shopping_lists where id = new.list_id;
  if v_owner is null then
    raise exception 'unknown shopping list' using errcode = '23503';
  end if;
  new.user_id := v_owner;
  return new;
end;
$$;

create trigger shopping_list_items_set_owner
  before insert or update of list_id, user_id on public.shopping_list_items
  for each row execute function public.shopping_list_items_set_owner();

-- ============================================================================
-- Seed (ADR-0017): key + body + apply_seed case + signup trigger
-- ============================================================================

create function public.seed_shopping_lists_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shopping_lists (user_id, is_default, position)
  values (p_user_id, true, 1000)
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
               'default_shopping_list']
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
  end case;
  return true;
end;
$$;

create function public.seed_default_shopping_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_seed(new.id, 'default_shopping_list');
  return new;
end;
$$;

create trigger on_auth_user_created_seed_shopping_list
  after insert on auth.users
  for each row execute function public.seed_default_shopping_list();

-- ============================================================================
-- Privileges: nothing here is callable by clients (#304)
-- ============================================================================

revoke execute on function
  public.shopping_list_items_set_owner(),
  public.seed_shopping_lists_for(uuid),
  public.seed_default_shopping_list(),
  public.apply_seed(uuid, text),
  public.seed_keys()
  from public, anon, authenticated;
