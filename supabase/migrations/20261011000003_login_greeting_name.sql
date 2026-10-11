-- #407 / ADR-0031: login greeting looks up the first name by e-mail. A
-- deliberate, rate-limited enumeration trade-off; read the ADR before changing
-- anything here.
--
-- The rate limit lives in the database (not the app) so a direct PostgREST call
-- is throttled too. The counter table sits in a `private` schema that
-- PostgREST does not expose, with RLS on, no policies and no client grants;
-- only the security definer function below writes to it.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table private.login_greeting_attempts (
  key text not null,
  attempted_at timestamptz not null default now()
);

create index login_greeting_attempts_key_attempted_at_idx
  on private.login_greeting_attempts (key, attempted_at);

comment on table private.login_greeting_attempts is
  'Rate-limit counter for public.login_greeting_name (ADR-0031). Holds only hashed keys (ip:<hash>, email:<sha256>, global), no user data, hence no user_id (ADR-0009 exception, asserted by supabase/tests/rls-login-greeting.sql). Rows older than 1 hour are purged on each call.';

alter table private.login_greeting_attempts enable row level security;
revoke all on private.login_greeting_attempts from anon, authenticated;

create function public.login_greeting_name(p_email text, p_client_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_ip_key text := 'ip:' || coalesce(p_client_key, '');
  -- sha256() is built into Postgres 13+ (pg_catalog); no pgcrypto needed.
  v_email_key text := 'email:' || pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_email, 'UTF8')), 'hex');
  v_global_key constant text := 'global';
  v_ip_count bigint;
  v_email_count bigint;
  v_global_count bigint;
  v_name text;
begin
  delete from private.login_greeting_attempts
  where attempted_at < pg_catalog.now() - interval '1 hour';

  -- Record this attempt under all three keys first, so the counts below
  -- include it (a blocked attempt still counts and extends the lockout).
  insert into private.login_greeting_attempts (key)
  values (v_ip_key), (v_email_key), (v_global_key);

  select
    pg_catalog.count(*) filter (where a.key = v_ip_key),
    pg_catalog.count(*) filter (where a.key = v_email_key),
    pg_catalog.count(*) filter (where a.key = v_global_key)
  into v_ip_count, v_email_count, v_global_count
  from private.login_greeting_attempts a
  where a.key in (v_ip_key, v_email_key, v_global_key)
    and a.attempted_at > pg_catalog.now() - interval '15 minutes';

  if v_ip_count > 10 or v_email_count > 5 or v_global_count > 200 then
    return null;
  end if;

  select p.display_name
  into v_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where pg_catalog.lower(u.email) = v_email
  limit 1;

  -- First whitespace-separated word of the trimmed name, or null.
  return (pg_catalog.regexp_match(pg_catalog.btrim(coalesce(v_name, '')), '^\S+'))[1];
end;
$$;

revoke execute on function public.login_greeting_name(text, text) from public, authenticated;
grant execute on function public.login_greeting_name(text, text) to anon;

comment on function public.login_greeting_name(text, text) is
  'ADR-0031: first word of profiles.display_name for an e-mail, or null (unknown address, empty name or rate limit exceeded, indistinguishable). Security definer, the repo''s only anon-callable one; called only by lib/auth/greeting-lookup.ts.';
