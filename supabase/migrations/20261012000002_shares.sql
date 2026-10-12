-- #423 (epic #420, ADR-0035): public.shares plus the access functions and
-- member RPCs that sharing a basket needs. Policies on shopping_lists and
-- shopping_list_items now follow the container's role (owner or accepted
-- editor) instead of user_id alone.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- ============================================================================
-- Schema private: policies call its functions, so clients need USAGE
-- ============================================================================

-- Functions only; tables in private stay ungranted (ADR-0031).
grant usage on schema private to authenticated;

-- ============================================================================
-- shares (exclusive arc: one nullable FK per shareable type)
-- ============================================================================

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  -- Owner and inviter.
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  shopping_list_id uuid references public.shopping_lists (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  role text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (member_id <> user_id),
  check (num_nonnulls(shopping_list_id) = 1),
  unique (shopping_list_id, member_id)
);

comment on table public.shares is
  'Invitations and memberships on shareable containers (ADR-0035). user_id is the owner; a share is active only once status = accepted. Declining, leaving and revoking delete the row.';

create index shares_user_id_idx on public.shares (user_id);
create index shares_member_id_idx on public.shares (member_id);

-- ============================================================================
-- Access functions (security definer so policies never recurse)
-- ============================================================================

create function private.shopping_list_role(p_list_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when l.user_id = (select auth.uid()) then 'owner'
    when exists (
      select 1 from public.shares s
      where s.shopping_list_id = l.id
        and s.member_id = (select auth.uid())
        and s.status = 'accepted'
    ) then 'editor'
  end
  from public.shopping_lists l
  where l.id = p_list_id
$$;

create function private.shares_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares s
    where (s.user_id = (select auth.uid()) and s.member_id = p_other)
       or (s.member_id = (select auth.uid()) and s.user_id = p_other)
  )
$$;

revoke execute on function
  private.shopping_list_role(uuid),
  private.shares_with(uuid)
  from public, anon;
grant execute on function
  private.shopping_list_role(uuid),
  private.shares_with(uuid)
  to authenticated;

-- ============================================================================
-- shares: RLS + grants
-- ============================================================================

alter table public.shares enable row level security;

create policy shares_select on public.shares
  for select to authenticated
  using (user_id = (select auth.uid()) or member_id = (select auth.uid()));

-- Only the container's owner invites, always pending/editor.
create policy shares_insert_owner on public.shares
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and member_id <> (select auth.uid())
    and status = 'pending'
    and role = 'editor'
    and responded_at is null
    and private.shopping_list_role(shopping_list_id) = 'owner'
  );

-- Only the invitee, and only pending -> accepted.
create policy shares_update_accept on public.shares
  for update to authenticated
  using (member_id = (select auth.uid()) and status = 'pending')
  with check (member_id = (select auth.uid()) and status = 'accepted');

-- Owner revokes; member declines or leaves.
create policy shares_delete on public.shares
  for delete to authenticated
  using (user_id = (select auth.uid()) or member_id = (select auth.uid()));

grant select, insert, delete on public.shares to authenticated;
grant update (status, responded_at) on public.shares to authenticated;
grant select, insert, update, delete on public.shares to service_role;

-- ============================================================================
-- Policies on shopping_lists / shopping_list_items follow the role
-- ============================================================================

drop policy shopping_lists_select_own on public.shopping_lists;
create policy shopping_lists_select_member on public.shopping_lists
  for select to authenticated
  using (private.shopping_list_role(id) in ('owner', 'editor'));

-- insert / update / delete stay owner-only (user_id = auth.uid()); #422's
-- rules (no client is_default, undeletable default, column grants) are kept.

drop policy shopping_list_items_select_own on public.shopping_list_items;
drop policy shopping_list_items_insert_own on public.shopping_list_items;
drop policy shopping_list_items_update_own on public.shopping_list_items;
drop policy shopping_list_items_delete_own on public.shopping_list_items;

-- The BEFORE INSERT trigger has already rewritten user_id to the list owner
-- when these run, so access is checked on list_id, never on user_id.
create policy shopping_list_items_select_member on public.shopping_list_items
  for select to authenticated
  using (private.shopping_list_role(list_id) in ('owner', 'editor'));
create policy shopping_list_items_insert_member on public.shopping_list_items
  for insert to authenticated
  with check (private.shopping_list_role(list_id) in ('owner', 'editor'));
create policy shopping_list_items_update_member on public.shopping_list_items
  for update to authenticated
  using (private.shopping_list_role(list_id) in ('owner', 'editor'))
  with check (private.shopping_list_role(list_id) in ('owner', 'editor'));
create policy shopping_list_items_delete_member on public.shopping_list_items
  for delete to authenticated
  using (private.shopping_list_role(list_id) in ('owner', 'editor'));

-- ============================================================================
-- Member RPCs (profiles policies are never widened)
-- ============================================================================

-- has_avatar is derived from profiles.avatar_url (always null today); #434
-- switches it to avatar_path. The path itself is never returned.
create function public.member_profiles(p_ids uuid[])
returns table (
  id uuid,
  display_name text,
  last_name text,
  has_avatar boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.last_name, p.avatar_url is not null, p.updated_at
  from public.profiles p
  where p.id = any (p_ids[1:100])
    and private.shares_with(p.id)
$$;

create table private.member_search_attempts (
  key text not null,
  attempted_at timestamptz not null default now()
);

create index member_search_attempts_key_attempted_at_idx
  on private.member_search_attempts (key, attempted_at);
create index member_search_attempts_attempted_at_idx
  on private.member_search_attempts (attempted_at);

comment on table private.member_search_attempts is
  'Rate-limit counter for public.search_members (ADR-0035, ADR-0031 pattern). Keys: user:<uuid> and global; no user_id column (ADR-0009 exception, asserted by supabase/tests/rls-member-search.sql). Rows older than 1 hour are purged on each call.';

alter table private.member_search_attempts enable row level security;
revoke all on private.member_search_attempts from anon, authenticated;

create function public.search_members(p_query text)
returns table (
  id uuid,
  display_name text,
  last_name text,
  has_avatar boolean,
  updated_at timestamptz,
  email text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_q text := pg_catalog.btrim(coalesce(p_query, ''));
  v_lower text;
  v_pattern text;
  v_user_key text;
  v_user_count bigint;
  v_global_count bigint;
begin
  if v_uid is null
     or pg_catalog.length(v_q) < 2
     or pg_catalog.length(v_q) > 64 then
    return;
  end if;

  v_user_key := 'user:' || v_uid::text;
  v_lower := pg_catalog.lower(v_q);
  v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
    v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  delete from private.member_search_attempts a
  where a.attempted_at < pg_catalog.now() - interval '1 hour';

  select
    pg_catalog.count(*) filter (where a.key = v_user_key),
    pg_catalog.count(*) filter (where a.key = 'global')
  into v_user_count, v_global_count
  from private.member_search_attempts a
  where a.key in (v_user_key, 'global')
    and a.attempted_at > pg_catalog.now() - interval '15 minutes';

  -- A blocked call records nothing, so it does not extend the lockout.
  if v_user_count >= 30 or v_global_count >= 500 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into private.member_search_attempts (key) values (v_user_key), ('global');

  return query
  select p.id, p.display_name, p.last_name, p.avatar_url is not null, p.updated_at,
         case when u.email = v_lower then u.email::text end
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id <> v_uid
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= pg_catalog.now())
    and (
      u.email = v_lower
      or pg_catalog.concat_ws(' ', p.display_name, p.last_name) ilike v_pattern
    )
  order by p.display_name, p.last_name, p.id
  limit 8;
end;
$$;

create function public.pending_share_invites()
returns table (
  share_id uuid,
  resource_type text,
  resource_id uuid,
  resource_name text,
  inviter_id uuid,
  inviter_display_name text,
  inviter_last_name text,
  inviter_has_avatar boolean,
  inviter_updated_at timestamptz,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, 'shopping_list'::text, l.id, l.name,
         p.id, p.display_name, p.last_name, p.avatar_url is not null, p.updated_at,
         s.created_at
  from public.shares s
  join public.shopping_lists l on l.id = s.shopping_list_id
  join public.profiles p on p.id = s.user_id
  where s.member_id = (select auth.uid())
    and s.status = 'pending'
  order by s.created_at desc
$$;

revoke execute on function
  public.member_profiles(uuid[]),
  public.search_members(text),
  public.pending_share_invites()
  from public, anon;
grant execute on function
  public.member_profiles(uuid[]),
  public.search_members(text),
  public.pending_share_invites()
  to authenticated;
