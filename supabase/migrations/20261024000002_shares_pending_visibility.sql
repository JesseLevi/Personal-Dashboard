-- Sharing privacy (ADR-0035 amendment 2026-10-24): a profile is shown only to
-- people you share with.
--   a. private.shares_with(): a pending share shows the inviter to the
--      invitee; the invitee's profile follows only once the share is accepted.
--      member_profiles() and avatar_path_for() inherit this.
--   b. Limits on new shares (baskets and recipe offers alike), enforced by a
--      BEFORE INSERT trigger on public.shares: 20 new shares per user per
--      hour, and at most 20 open (pending) shares per inviter.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- ============================================================================
-- a. shares_with: pending counts in one direction only
-- ============================================================================
-- Recipe offers are never accepted (ADR-0036), so they only ever show the
-- sender to the recipient.

create or replace function private.shares_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares s
    where (s.member_id = (select auth.uid()) and s.user_id = p_other)
       or (s.user_id = (select auth.uid()) and s.member_id = p_other
           and s.status = 'accepted')
  )
$$;

-- ============================================================================
-- b. Limits on new shares
-- ============================================================================

create table private.share_invite_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index share_invite_events_user_id_created_at_idx
  on private.share_invite_events (user_id, created_at);
create index share_invite_events_created_at_idx
  on private.share_invite_events (created_at);

comment on table private.share_invite_events is
  'Rate-limit counter for new rows in public.shares (ADR-0035). One row per share created by user_id; rows older than 1 hour are purged on each insert. Written only by private.limit_share_inserts().';

alter table private.share_invite_events enable row level security;
revoke all on private.share_invite_events from anon, authenticated;

-- Every insert path (basket invite, recipe offer, any client) goes through
-- public.shares, so the limit lives in a trigger. A rejected insert rolls the
-- whole statement back, so it records nothing and does not extend the lockout.
create function private.limit_share_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise concurrent inserts by the same inviter.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('share_insert|' || new.user_id::text, 0));

  delete from private.share_invite_events e
  where e.created_at < pg_catalog.now() - interval '1 hour';

  if (select pg_catalog.count(*) from private.share_invite_events e
      where e.user_id = new.user_id) >= 20
     or (select pg_catalog.count(*) from public.shares s
         where s.user_id = new.user_id and s.status = 'pending') >= 20 then
    raise exception 'share_limit' using errcode = 'P0001';
  end if;

  insert into private.share_invite_events (user_id) values (new.user_id);
  return new;
end;
$$;

revoke execute on function private.limit_share_inserts() from public, anon, authenticated;

create trigger shares_limit_inserts
  before insert on public.shares
  for each row execute function private.limit_share_inserts();
