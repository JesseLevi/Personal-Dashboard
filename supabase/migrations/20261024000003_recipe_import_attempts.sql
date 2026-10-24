-- Import rate limit as its own counter (ADR-0019 §5). The limit used to count
-- `recipes` rows with source_url, which a user can delete; an append-only
-- table in the `private` schema (RLS on, no policies, no client grants) that
-- only the security definer function below touches cannot be lowered from the
-- client.
--
-- The function checks and records in one step under an advisory lock, so
-- parallel requests cannot all slip under the limit. The caller is always
-- auth.uid(): there is no user-id parameter. A refused call records nothing.

create table private.recipe_import_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index recipe_import_attempts_user_attempted_at_idx
  on private.recipe_import_attempts (user_id, attempted_at);

create index recipe_import_attempts_attempted_at_idx
  on private.recipe_import_attempts (attempted_at);

comment on table private.recipe_import_attempts is
  'Rate-limit counter for public.consume_recipe_import_attempt (one row per started import or retry). Only that security definer function touches it: a client with write access could lower its own count, so there are no grants and no policies. Rows older than 1 hour are purged on each call.';

alter table private.recipe_import_attempts enable row level security;
revoke all on private.recipe_import_attempts from anon, authenticated;

-- Returns true when the caller may start an import (fewer than 20 in the last
-- hour; the attempt is recorded), false when the limit is reached or there is
-- no signed-in user. Keep the limit in step with IMPORTS_PER_HOUR in
-- lib/recipes/import/rate-limit.ts.
create function public.consume_recipe_import_attempt()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('recipe_import|' || v_user::text, 0));

  delete from private.recipe_import_attempts
  where attempted_at < pg_catalog.now() - interval '1 hour';

  if (select pg_catalog.count(*) from private.recipe_import_attempts a
      where a.user_id = v_user
        and a.attempted_at > pg_catalog.now() - interval '1 hour') >= 20 then
    return false;
  end if;

  insert into private.recipe_import_attempts (user_id) values (v_user);
  return true;
end;
$$;

revoke execute on function public.consume_recipe_import_attempt() from public, anon;
grant execute on function public.consume_recipe_import_attempt() to authenticated;

comment on function public.consume_recipe_import_attempt() is
  'Import rate limit: true = allowed and recorded. Security definer, acts on auth.uid() only; called by lib/recipes/import/rate-limit.ts.';
