-- #293: lazy, idempotent "ensure defaults" for every per-user seed.
--
-- Problem: seed_default_board / seed_default_recipe_categories /
-- seed_default_note_categories are `after insert on auth.users` triggers, so
-- accounts that existed before a trigger was added never got that seed, and
-- every future seed function would inherit the gap. Decision (ADR-0017):
-- keep the triggers (new accounts are seeded unconditionally) AND add one
-- RPC, public.ensure_user_defaults(), that the app calls on authenticated
-- loads and that applies every registered seed the caller does not have yet.
-- No production backfill is done here; the first load of each existing
-- account does it, once.
--
-- Shape (one home per seed):
--   user_seeds                 per-user marker table: "seed X ran for user U".
--   seed_keys()                the registry of seed keys.
--   seed_*_for(user_id)        the one body per seed (insert-only, with a
--                              "user has zero rows" guard).
--   apply_seed(user_id, key)   the single mechanism: claim the marker, run the
--                              body only if the claim was ours.
--   seed_default_*() triggers  now thin wrappers around apply_seed().
--   ensure_user_defaults()     the RPC: apply_seed for every key, for
--                              auth.uid().
-- Adding a future seed = a key in seed_keys(), a body, a `when` in
-- apply_seed(), and (for new accounts) a trigger wrapper.
--
-- Idempotency / concurrency: the marker's primary key (user_id, seed_key) is
-- the lock. apply_seed() does `insert ... on conflict do nothing`; a
-- concurrent second transaction blocks on the first's uncommitted marker row,
-- and after the first commits sees the conflict and does nothing. The marker
-- and the seed rows commit in the same transaction, so there is no state
-- "marked but not seeded" or "seeded twice". A pure "zero rows" check alone
-- would be racy (two transactions both see zero) and would re-seed a user who
-- deliberately deleted all their categories; the marker prevents both. The
-- zero-rows guard inside each body is the extra safety for legacy accounts
-- that predate the marker: an existing account that already has data (e.g. a
-- customised board or the #119 recipe backfill) is marked, not reseeded.
-- Known edge: a legacy account that had already deleted every row of a seed
-- table is reseeded once, on its first load after this ships.
--
-- Privileges (#189 / #304): the seed bodies and apply_seed take a user id, so
-- they must never be callable by a client: EXECUTE is revoked from public,
-- anon AND authenticated (Supabase's default privileges would otherwise grant
-- authenticated). Only ensure_user_defaults() is granted, to authenticated and
-- service_role; it reads auth.uid() and has no user-id parameter. The trigger
-- functions keep no client grants (#304).
--
-- Reaches the hosted database only via deploy.yml (ADR-0012); this migration
-- does not seed anything by itself.

-- ============================================================================
-- Marker table
-- ============================================================================

create table public.user_seeds (
  user_id uuid not null references auth.users (id) on delete cascade,
  seed_key text not null,
  seeded_at timestamptz not null default now(),
  primary key (user_id, seed_key)
);

comment on table public.user_seeds is
  'Marker per (user, seed): the seed ran for this user and must not run '
  'again, even if the user later deletes the seeded rows (#293, ADR-0017). '
  'Written only by apply_seed() (security definer); clients can only read '
  'their own markers.';

alter table public.user_seeds enable row level security;

create policy user_seeds_select_own on public.user_seeds
  for select using (user_id = (select auth.uid()));

-- No insert/update/delete policy and no such grant for clients: the markers
-- are written by the security definer functions below only.
grant select on public.user_seeds to authenticated;
grant select, insert, update, delete on public.user_seeds to service_role;

-- ============================================================================
-- Seed bodies (one home per seed)
-- ============================================================================

create function public.seed_board_for(p_user_id uuid)
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

  insert into public.board_columns (user_id, board_id, name, icon, position)
  values
    (p_user_id, new_board_id, 'Ideeën', 'Lightbulb', 1000),
    (p_user_id, new_board_id, 'Klaar', 'AlarmClockCheck', 2000),
    (p_user_id, new_board_id, 'Bezig', 'Loader', 3000),
    (p_user_id, new_board_id, 'Afgerond', 'CircleCheck', 4000);
end;
$$;

create function public.seed_recipe_categories_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.recipe_categories where user_id = p_user_id) then
    return;
  end if;

  insert into public.recipe_categories (user_id, name, icon, position)
  values
    (p_user_id, 'Ontbijt', 'Croissant', 1000),
    (p_user_id, 'Lunch', 'Sandwich', 2000),
    (p_user_id, 'Avond', 'Broccoli', 3000);
end;
$$;

create function public.seed_note_categories_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.note_categories where user_id = p_user_id) then
    return;
  end if;

  insert into public.note_categories (user_id, name, icon, position)
  values
    (p_user_id, 'Overig', 'FolderClosed', 1000),
    (p_user_id, 'Werk', 'Lightbulb', 2000),
    -- Deliberately reuses FolderClosed, same as 'Overig' -- Figma design
    -- (node 4067:18615), not a copy-paste bug.
    (p_user_id, 'Sport', 'FolderClosed', 3000);
end;
$$;

-- ============================================================================
-- Registry + the single mechanism
-- ============================================================================

create function public.seed_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['default_board', 'default_recipe_categories', 'default_note_categories']
$$;

create function public.apply_seed(p_user_id uuid, p_key text)
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

  -- The claim: the primary key serialises concurrent callers (see header).
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
  end case;
  return true;
end;
$$;

-- ============================================================================
-- Triggers: same functions as before, now thin wrappers (create or replace
-- keeps the existing on_auth_user_created_seed_* triggers attached).
-- ============================================================================

create or replace function public.seed_default_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_seed(new.id, 'default_board');
  return new;
end;
$$;

create or replace function public.seed_default_recipe_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_seed(new.id, 'default_recipe_categories');
  return new;
end;
$$;

create or replace function public.seed_default_note_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_seed(new.id, 'default_note_categories');
  return new;
end;
$$;

-- ============================================================================
-- The RPC
-- ============================================================================

create function public.ensure_user_defaults()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_key text;
begin
  if v_user_id is null then
    raise exception 'ensure_user_defaults requires an authenticated user'
      using errcode = '42501';
  end if;

  -- Cheap early exit for the steady state: one indexed count (PK prefix).
  if (select count(*) from public.user_seeds where user_id = v_user_id)
     >= cardinality(public.seed_keys()) then
    return;
  end if;

  foreach v_key in array public.seed_keys() loop
    perform public.apply_seed(v_user_id, v_key);
  end loop;
end;
$$;

comment on function public.ensure_user_defaults is
  'Lazy, idempotent seeding of every per-user default (#293, ADR-0017). '
  'security definer but scoped to auth.uid(); no user-id parameter. Called '
  'from app/(app)/layout.tsx on authenticated loads.';

-- ============================================================================
-- Privileges
-- ============================================================================

revoke execute on function
  public.seed_board_for(uuid),
  public.seed_recipe_categories_for(uuid),
  public.seed_note_categories_for(uuid),
  public.apply_seed(uuid, text),
  public.seed_keys()
  from public, anon, authenticated;

revoke execute on function public.ensure_user_defaults() from public, anon;
grant execute on function public.ensure_user_defaults()
  to authenticated, service_role;

-- CREATE OR REPLACE keeps existing ACLs, but restate the trigger functions'
-- no-client-grant state (#304) so this migration is self-evidently safe.
revoke execute on function
  public.seed_default_board(),
  public.seed_default_recipe_categories(),
  public.seed_default_note_categories()
  from public, anon, authenticated;
