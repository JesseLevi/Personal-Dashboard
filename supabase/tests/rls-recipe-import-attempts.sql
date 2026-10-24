-- public.consume_recipe_import_attempt + private.recipe_import_attempts. The
-- table lives outside `public`, so check-rls-coverage.sh does not see it; its
-- isolation is asserted here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'imp-a@test.local'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'imp-b@test.local');

select ok(
  has_function_privilege('authenticated', 'public.consume_recipe_import_attempt()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.consume_recipe_import_attempt()', 'EXECUTE'),
  'only authenticated can execute consume_recipe_import_attempt'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.consume_recipe_import_attempt()'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on consume_recipe_import_attempt'
);
select ok(
  not has_table_privilege('anon', 'private.recipe_import_attempts', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'private.recipe_import_attempts', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon and authenticated have no table privileges on the attempts table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.recipe_import_attempts'::regclass),
  'RLS is enabled on the attempts table'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok($$ select public.consume_recipe_import_attempt() $$, '42501', null,
  'anon cannot call consume_recipe_import_attempt');

set local role authenticated;
select throws_ok($$ select * from private.recipe_import_attempts $$, '42501', null,
  'authenticated cannot select the attempts table');
select throws_ok($$ delete from private.recipe_import_attempts $$, '42501', null,
  'authenticated cannot delete from the attempts table');

-- User A: 20 attempts pass, the 21st is refused.
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select count(*) filter (where ok)::int from (
     select public.consume_recipe_import_attempt() as ok from generate_series(1, 20)) s),
  20,
  'twenty attempts in an hour pass'
);
select is(public.consume_recipe_import_attempt(), false, 'the 21st attempt is refused');

-- Deleting recipes does not free budget: the counter is not derived from them.
delete from public.recipes where user_id = 'a0000000-0000-4000-8000-000000000001';
select is(public.consume_recipe_import_attempt(), false,
  'deleting recipes does not free import budget');

-- User B is unaffected.
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(public.consume_recipe_import_attempt(), true, 'another user is unaffected');

-- A refused call records nothing; old rows are purged and free budget.
reset role;
select is(
  (select count(*)::int from private.recipe_import_attempts
   where user_id = 'a0000000-0000-4000-8000-000000000001'),
  20,
  'refused calls record nothing'
);
update private.recipe_import_attempts set attempted_at = now() - interval '2 hours'
where user_id = 'a0000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.consume_recipe_import_attempt(), true,
  'attempts older than an hour no longer count');

select * from finish();
rollback;
