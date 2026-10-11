-- #407 / ADR-0031: login greeting looks up the first name by e-mail.
-- A deliberate enumeration trade-off, limited by a DB-side rate limit so a
-- direct PostgREST call is throttled too. The only caller is the server
-- action (anon key is server-only, ADR-0003).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.login_greeting_attempts (
  key text not null,
  attempted_at timestamptz not null default now()
);

comment on table private.login_greeting_attempts is
  'ADR-0031: rate-limit attempts for public.login_greeting_name(). Holds only hashed keys (ip:/email: sha256, global), no user data, hence no user_id. Outside public on purpose; isolation asserted by supabase/tests/rls-login-greeting.sql.';

create index login_greeting_attempts_key_attempted_at_idx
  on private.login_greeting_attempts (key, attempted_at);

alter table private.login_greeting_attempts enable row level security;
-- No policies: only the security definer function below touches the table.
revoke all on table private.login_greeting_attempts from public, anon, authenticated;

create function public.login_greeting_name(p_email text, p_client_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip_key text := 'ip:' || coalesce(p_client_key, '');
  v_email_key text := 'email:' || encode(extensions.digest(v_email, 'sha256'), 'hex');
  v_global_key constant text := 'global';
  v_window constant interval := interval '15 minutes';
  v_limited boolean;
  v_name text;
begin
  delete from private.login_greeting_attempts
  where attempted_at < now() - interval '1 hour';

  select
    (select count(*) from private.login_greeting_attempts
       where key = v_ip_key and attempted_at > now() - v_window) >= 10
    or (select count(*) from private.login_greeting_attempts
       where key = v_email_key and attempted_at > now() - v_window) >= 5
    or (select count(*) from private.login_greeting_attempts
       where key = v_global_key and attempted_at > now() - v_window) >= 200
  into v_limited;

  insert into private.login_greeting_attempts (key)
  values (v_ip_key), (v_email_key), (v_global_key);

  if v_limited or v_email = '' then
    return null;
  end if;

  select substring(btrim(p.display_name) from '^\S+')
  into v_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = v_email
  limit 1;

  return v_name;
end;
$$;

comment on function public.login_greeting_name(text, text) is
  'ADR-0031: first word of profiles.display_name for the login greeting, or null (unknown address, empty name, or rate limit exceeded; indistinguishable). Security definer, executable by anon only; limits per 15 min: ip 10, email 5, global 200.';

revoke execute on function public.login_greeting_name(text, text) from public, authenticated;
grant execute on function public.login_greeting_name(text, text) to anon;
