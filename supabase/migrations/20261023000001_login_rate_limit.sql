-- Rate limit for the login actions (password, code send, code verify), kept in
-- the database like the greeting lookup (ADR-0031). Same shape: a counter table
-- in the `private` schema (RLS on, no policies, no client grants) that only the
-- security definer function below touches.
--
-- Events are attempts, not failures: 'consume' checks and records in one step
-- under an advisory lock, so parallel requests cannot all slip under the limit;
-- 'refund' removes the latest event per key after a success. A blocked call
-- records nothing, so it does not extend a lockout.

create table private.login_rate_events (
  key text not null,
  created_at timestamptz not null default now()
);

create index login_rate_events_key_created_at_idx
  on private.login_rate_events (key, created_at);

create index login_rate_events_created_at_idx
  on private.login_rate_events (created_at);

comment on table private.login_rate_events is
  'Rate-limit counter for public.login_rate_limit. Holds only hashed keys (<action>|email:<sha256>, <action>|ip:<hash>, <action>|global), no user data, hence no user_id (ADR-0009 exception, asserted by supabase/tests/rls-login-rate-limit.sql). Rows older than 1 hour are purged on each call.';

alter table private.login_rate_events enable row level security;
revoke all on private.login_rate_events from anon, authenticated;

-- Returns true when the call may proceed. Limits are events per 15 minutes:
--   password: 8 per address, 20 per client, 1000 global
--   verify:   5 per address, 20 per client, 1000 global
--   send:     3 per address, 10 per client, 100 global
-- A granted 'send' also resets the address's verify counter: the new code is a
-- new secret, so the old guesses no longer count against it.
create function public.login_rate_limit(
  p_action text,
  p_email text,
  p_client_key text,
  p_mode text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_hash text;
  v_email_key text;
  v_ip_key text;
  v_global_key text;
  v_email_limit int;
  v_ip_limit int;
  v_global_limit int;
  v_key text;
begin
  if p_action is null or p_action not in ('password', 'verify', 'send')
     or p_mode is null or p_mode not in ('consume', 'refund')
     or v_email = ''
     or pg_catalog.length(v_email) > 254
     or pg_catalog.length(coalesce(p_client_key, '')) > 128 then
    return false;
  end if;

  v_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_email, 'UTF8')), 'hex');
  v_email_key := p_action || '|email:' || v_hash;
  v_ip_key := p_action || '|ip:' || coalesce(p_client_key, '');
  v_global_key := p_action || '|global';

  if p_mode = 'refund' then
    foreach v_key in array array[v_email_key, v_ip_key, v_global_key] loop
      delete from private.login_rate_events e
      where e.ctid = (
        select e2.ctid from private.login_rate_events e2
        where e2.key = v_key
        order by e2.created_at desc
        limit 1
      );
    end loop;
    return true;
  end if;

  v_email_limit := case p_action when 'password' then 8 when 'verify' then 5 else 3 end;
  v_ip_limit := case p_action when 'send' then 10 else 20 end;
  v_global_limit := case p_action when 'send' then 100 else 1000 end;

  -- Serialise concurrent calls for the same address and client (fixed order).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email_key, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_ip_key, 0));

  delete from private.login_rate_events
  where created_at < pg_catalog.now() - interval '1 hour';

  if (select pg_catalog.count(*) from private.login_rate_events e
      where e.key = v_email_key
        and e.created_at > pg_catalog.now() - interval '15 minutes') >= v_email_limit
     or (select pg_catalog.count(*) from private.login_rate_events e
      where e.key = v_ip_key
        and e.created_at > pg_catalog.now() - interval '15 minutes') >= v_ip_limit
     or (select pg_catalog.count(*) from private.login_rate_events e
      where e.key = v_global_key
        and e.created_at > pg_catalog.now() - interval '15 minutes') >= v_global_limit then
    return false;
  end if;

  insert into private.login_rate_events (key)
  values (v_email_key), (v_ip_key), (v_global_key);

  if p_action = 'send' then
    delete from private.login_rate_events where key = 'verify|email:' || v_hash;
  end if;

  return true;
end;
$$;

revoke execute on function public.login_rate_limit(text, text, text, text) from public, authenticated;
grant execute on function public.login_rate_limit(text, text, text, text) to anon;

comment on function public.login_rate_limit(text, text, text, text) is
  'Rate limit for login actions: true = allowed. Security definer, anon-callable like login_greeting_name; called only by lib/auth/login-rate-limit.ts.';
