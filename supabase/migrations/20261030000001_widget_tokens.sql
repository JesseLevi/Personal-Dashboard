-- #654 (epic #653, ADR-0047 §3-5): the data foundation of the iPhone day widget.
--   public.widget_tokens         personal read-only credentials, stored as a SHA-256 hash
--   private.widget_rate_events   120 calls per token per hour (shape of ADR-0045)
--   private.widget_token_owner   hash lookup + rate limit + last_used_at, definer = migration role
--   role atlas_widget            nologin, member of authenticated, no bypassrls
--   public.widget_today          reads the owner's day under RLS, owned by atlas_widget
--
-- No service_role anywhere. Additive only (ADR-0032 §5). Not applied to hosted
-- by merging: needs the user's explicit go. Any new function owned by
-- atlas_widget needs a new ADR (ADR-0047).

-- ============================================================================
-- widget_tokens
-- ============================================================================

create table public.widget_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.widget_tokens is
  'Widget credentials (ADR-0047). token_hash is the hex SHA-256 of the full plaintext incl. the atlas_wgt_ prefix; the plaintext is never stored. token_hash is not readable by authenticated; only private.widget_token_owner reads it. At most 5 per user.';

create index widget_tokens_user_id_idx on public.widget_tokens (user_id);

alter table public.widget_tokens enable row level security;

create policy widget_tokens_select_own on public.widget_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy widget_tokens_insert_own on public.widget_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy widget_tokens_update_own on public.widget_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy widget_tokens_delete_own on public.widget_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.widget_tokens from anon, authenticated;
grant select (id, user_id, label, created_at, last_used_at) on public.widget_tokens to authenticated;
grant insert (label, token_hash) on public.widget_tokens to authenticated;
grant update (label) on public.widget_tokens to authenticated;
grant delete on public.widget_tokens to authenticated;

-- At most 5 tokens per user. The advisory lock serialises parallel inserts.
create function public.widget_tokens_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('widget_tokens|' || new.user_id::text, 0));
  if (select pg_catalog.count(*) from public.widget_tokens t where t.user_id = new.user_id) >= 5 then
    raise exception 'widget token limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.widget_tokens_limit() from public, anon, authenticated;

create trigger widget_tokens_limit
  before insert on public.widget_tokens
  for each row execute function public.widget_tokens_limit();

-- ============================================================================
-- Rate-limit events (ADR-0045 shape)
-- ============================================================================

create table private.widget_rate_events (
  key text not null,
  created_at timestamptz not null default now()
);

create index widget_rate_events_key_created_at_idx
  on private.widget_rate_events (key, created_at);
create index widget_rate_events_created_at_idx
  on private.widget_rate_events (created_at);

comment on table private.widget_rate_events is
  'Rate-limit counter for private.widget_token_owner. Key is widget|<token id>; no user data, hence no user_id (ADR-0009 exception, asserted by supabase/tests/rls-widget_tokens.sql). Rows older than 1 hour are purged on each call.';

alter table private.widget_rate_events enable row level security;
revoke all on private.widget_rate_events from anon, authenticated;

-- ============================================================================
-- The role
-- ============================================================================

create role atlas_widget nologin inherit nobypassrls;
grant authenticated to atlas_widget;
-- Needed to hand ownership of widget_today to the role; the migration role
-- never logs in as it.
grant atlas_widget to postgres;

grant usage on schema private to atlas_widget;

-- ============================================================================
-- Token lookup (definer = migration role)
-- ============================================================================

create function private.widget_token_owner(p_token text)
returns table (status text, user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_key text;
begin
  if p_token is null or pg_catalog.length(p_token) > 200 then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  select t.id, t.user_id into v_id, v_owner
  from public.widget_tokens t
  where t.token_hash = pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex');

  if v_id is null then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  v_key := 'widget|' || v_id::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));

  delete from private.widget_rate_events
  where created_at < pg_catalog.now() - interval '1 hour';

  if (select pg_catalog.count(*) from private.widget_rate_events e
      where e.key = v_key
        and e.created_at > pg_catalog.now() - interval '1 hour') >= 120 then
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  insert into private.widget_rate_events (key) values (v_key);
  update public.widget_tokens t set last_used_at = pg_catalog.now() where t.id = v_id;

  return query select 'ok'::text, v_owner;
end;
$$;

revoke execute on function private.widget_token_owner(text) from public, anon, authenticated;
grant execute on function private.widget_token_owner(text) to atlas_widget;

comment on function private.widget_token_owner(text) is
  'Resolves a widget token plaintext to its owner: hashes in the database, applies 120 calls/token/hour, stamps last_used_at. Status ok, unauthorized or rate_limited. Executable by atlas_widget only (ADR-0047).';

-- ============================================================================
-- widget_today (owner atlas_widget, so RLS applies to its reads)
-- ============================================================================

create function public.widget_today(
  p_token text,
  p_from timestamptz,
  p_to timestamptz,
  p_time_zone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_locale text;
  v_items jsonb;
begin
  select o.status, o.user_id into v_status, v_owner
  from private.widget_token_owner(p_token) o;

  if v_status is distinct from 'ok' or v_owner is null then
    return pg_catalog.jsonb_build_object('status', coalesce(v_status, 'unauthorized'));
  end if;

  -- Transaction-local: from here on auth.uid() is the token's owner and the
  -- existing policies (and sharing role functions) decide what is visible.
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true);

  select p.locale into v_locale from public.profiles p where p.id = v_owner;

  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.to_jsonb(i) || pg_catalog.jsonb_build_object('color', c.color)
           order by i.starts_at nulls last, i.planned_on nulls last, i.title, i.id), '[]'::jsonb)
  into v_items
  from public.agenda_items(p_from, p_to, p_time_zone) i
  left join public.calendars c on c.id = i.calendar_id;

  perform pg_catalog.set_config('request.jwt.claims', '', true);

  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'locale', coalesce(v_locale, 'nl'),
    'items', v_items);
end;
$$;

alter function public.widget_today(text, timestamptz, timestamptz, text) owner to atlas_widget;

revoke execute on function public.widget_today(text, timestamptz, timestamptz, text)
  from public, authenticated, service_role;
grant execute on function public.widget_today(text, timestamptz, timestamptz, text) to anon;

comment on function public.widget_today(text, timestamptz, timestamptz, text) is
  'Day for a widget token (ADR-0047). security definer, owned by atlas_widget (no bypassrls); sets the owner as auth.uid() transaction-locally and reads agenda_items, calendars.color and profiles.locale under RLS. Read-only; anon-callable.';
