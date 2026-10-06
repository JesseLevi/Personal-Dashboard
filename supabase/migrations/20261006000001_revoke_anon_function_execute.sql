-- #304: anon had EXECUTE on every function in public. Each RPC migration
-- (replace_recipe_contents, move_card, move_recipe, move_note) only revoked
-- from the PUBLIC pseudo-role, but Supabase's default privileges also give
-- anon a *direct* EXECUTE grant on every new function in public, and that
-- grant survives `revoke ... from public`. Measured in CI on 2026-10-06
-- (ci-db.yml run 37516221286): anon reached move_card/move_recipe/move_note
-- and was only stopped by RLS (MV404) instead of by the grant (42501).
-- No data exposure (all RPCs are security invoker, RLS governs every row),
-- but it breaks ADR-0009's "anon gets nothing" and every future function
-- would inherit it.
--
-- Three parts:
--   1. Existing functions: revoke EXECUTE from anon (and PUBLIC, which anon
--      is a member of) on every function in public that isn't an
--      extension member. authenticated/service_role keep their direct
--      grants, so the RPCs behave exactly as before for signed-in users.
--   2. Trigger functions (handle_new_user, seed_default_*, set_updated_at):
--      also revoke from authenticated. A trigger function is never called
--      by the user firing the trigger, so nobody needs EXECUTE on it --
--      this closes the function half of #189's advisor WARNs for the
--      security definer seed functions.
--   3. Future functions created by postgres (i.e. by migrations): no
--      implicit EXECUTE for PUBLIC or anon. New RPCs already grant
--      authenticated/service_role explicitly (docs/guides/data-layer.md),
--      so nothing else changes. The PUBLIC default is a global one and can
--      only be revoked without `in schema` -- a per-schema revoke cannot
--      remove a global default.
--
-- Functions Supabase itself owns (e.g. hosted's rls_auto_enable) are not
-- ours to change; postgres can't revoke on them anyway.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig,
           p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) as is_trigger
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proowner = 'postgres'::regrole
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    if fn.is_trigger then
      execute format('revoke execute on function %s from authenticated', fn.sig);
    end if;
  end loop;
end;
$$;

alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
