-- Function-grant test for #304 (20261006000001_revoke_anon_function_execute.sql):
-- ADR-0009's "anon gets nothing" extended from tables to every function we
-- own in public, plus the default privileges that keep future functions in
-- line. Per-RPC ownership guards stay in rls-move-rpcs.sql,
-- rls-move-note-rpc.sql and rls-recipe_step_ingredients.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Every non-extension function postgres owns in public.
create temporary view own_public_functions as
  select p.oid, p.oid::regprocedure::text as sig,
         p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) as is_trigger
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_userbyid(p.proowner) = 'postgres'
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    );

select is(
  (select array_agg(sig order by sig) from own_public_functions
   where has_function_privilege('anon', oid, 'EXECUTE')),
  null,
  'anon has EXECUTE on none of our public functions'
);

select is(
  (select array_agg(sig order by sig) from own_public_functions
   where is_trigger and has_function_privilege('authenticated', oid, 'EXECUTE')),
  null,
  'authenticated has EXECUTE on none of our trigger functions'
);

select ok(
  has_function_privilege('authenticated', 'public.move_card(uuid, uuid, int)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.move_recipe(uuid, uuid, int)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.move_note(uuid, uuid, int)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.replace_recipe_contents(uuid, jsonb, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.match_ingredient_candidates(text[], int)', 'EXECUTE'),
  'authenticated keeps EXECUTE on the RPCs'
);

-- A function created after the migration (as a later migration would) gets
-- no implicit grant for anon.
create function public.zz_test_future_function() returns int
language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.zz_test_future_function()', 'EXECUTE'),
  'a newly created public function is not executable by anon'
);

set local role anon;
select throws_ok(
  $$ select public.zz_test_future_function() $$,
  '42501',
  null,
  'anon calling a newly created public function is refused by the grant'
);

select * from finish();
rollback;
