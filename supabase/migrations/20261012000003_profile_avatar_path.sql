-- #434 (epic #420): profile photo. profiles.avatar_path holds the R2 object
-- key of the 120x120 WebP (`<user_id>/avatar/<uuid>.webp`, ADR-0024).
--
-- Additive on purpose: profiles.avatar_url (#265, null everywhere, never
-- written) is kept for now, because the app version currently deployed
-- selects it in the layout query and a drop before promotion would break
-- that query. A follow-up migration drops it once this code is live
-- (ADR-0032: migrations are written so promotion may lag).
--
-- No new table: the four profiles policies and table-level grants already
-- cover the new column.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

alter table public.profiles
  add column avatar_path text;

comment on column public.profiles.avatar_path is
  'R2 object key of the profile photo (120x120 WebP), or null. Never returned to other members: they only see has_avatar and fetch the image through /api/avatar/<id> (#434).';

-- Delivery check for /api/avatar/[userId]: returns the key only to the owner
-- or to someone sharing a container with them (private.shares_with, any
-- direction or status, ADR-0035). The access decision stays in SQL.
create function public.avatar_path_for(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.avatar_path
  from public.profiles p
  where p.id = p_user_id
    and p.avatar_path is not null
    and (p.id = (select auth.uid()) or private.shares_with(p.id))
$$;

revoke execute on function public.avatar_path_for(uuid) from public, anon;
grant execute on function public.avatar_path_for(uuid) to authenticated;

-- has_avatar now derives from avatar_path (was avatar_url, #423).
create or replace function public.member_profiles(p_ids uuid[])
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
  select p.id, p.display_name, p.last_name, p.avatar_path is not null, p.updated_at
  from public.profiles p
  where p.id = any (p_ids[1:100])
    and private.shares_with(p.id)
$$;

create or replace function public.search_members(p_query text)
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
  select p.id, p.display_name, p.last_name, p.avatar_path is not null, p.updated_at,
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

create or replace function public.pending_share_invites()
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
         p.id, p.display_name, p.last_name, p.avatar_path is not null, p.updated_at,
         s.created_at
  from public.shares s
  join public.shopping_lists l on l.id = s.shopping_list_id
  join public.profiles p on p.id = s.user_id
  where s.member_id = (select auth.uid())
    and s.status = 'pending'
  order by s.created_at desc
$$;
