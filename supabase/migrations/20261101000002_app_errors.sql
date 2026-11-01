-- Production error log (ADR-0049).
--   private.app_errors       last server errors: route pattern, method, digest, name, short message
--   public.report_app_error  definer, anon-callable, writes only with the Vault secret
--
-- What is stored is deliberately thin: no user id, no query string, no body,
-- no cookies, no e-mail. The secret lives in Vault as 'app_error_report_secret'
-- and in Vercel as APP_ERROR_REPORT_SECRET; without it every call is a no-op.
-- Not applied to hosted by merging: needs the user's explicit go.

create table private.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  route text not null,
  method text not null,
  kind text not null,
  digest text,
  error_name text not null,
  message text not null
);

create index app_errors_created_at_idx on private.app_errors (created_at);

comment on table private.app_errors is
  'Server errors reported by instrumentation.ts (ADR-0049). Holds no user data, hence no user_id (ADR-0009 exception, asserted by supabase/tests/rls-app-errors.sql). Capped at 60 rows per minute and the newest 1000 rows.';

alter table private.app_errors enable row level security;
revoke all on private.app_errors from anon, authenticated;

create function public.report_app_error(
  p_secret text,
  p_route text,
  p_method text,
  p_kind text,
  p_digest text,
  p_error_name text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
begin
  select s.decrypted_secret into v_expected
  from vault.decrypted_secrets s
  where s.name = 'app_error_report_secret'
  limit 1;

  if v_expected is null or pg_catalog.length(v_expected) < 16
     or p_secret is null or p_secret <> v_expected then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('app_errors', 0));

  if (select pg_catalog.count(*) from private.app_errors e
      where e.created_at > pg_catalog.now() - interval '1 minute') >= 60 then
    return;
  end if;

  insert into private.app_errors (route, method, kind, digest, error_name, message)
  values (
    pg_catalog.left(coalesce(nullif(pg_catalog.split_part(p_route, '?', 1), ''), '?'), 200),
    pg_catalog.left(pg_catalog.upper(coalesce(p_method, '?')), 10),
    pg_catalog.left(coalesce(p_kind, '?'), 40),
    pg_catalog.left(nullif(p_digest, ''), 64),
    pg_catalog.left(coalesce(p_error_name, 'Error'), 100),
    pg_catalog.left(coalesce(p_message, ''), 300)
  );

  delete from private.app_errors
  where id <= (select e.id from private.app_errors e order by e.id desc offset 1000 limit 1);
end;
$$;

comment on function public.report_app_error is
  'Appends one row to private.app_errors when p_secret matches the Vault secret '
  '''app_error_report_secret'' (ADR-0049); otherwise does nothing. Truncates every '
  'field and drops the query string. security definer, anon-callable.';

revoke execute on function public.report_app_error(text, text, text, text, text, text, text) from public, authenticated;
grant execute on function public.report_app_error(text, text, text, text, text, text, text) to anon;
