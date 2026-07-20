-- ADR-0009: no table ships without RLS. This test fails the suite the moment
-- any public table exists with row security disabled — regardless of whether
-- a per-table test was written.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and rowsecurity = false $$,
  'every public table has RLS enabled'
);

-- Force RLS even for table owners is not used; policies must exist too:
select is_empty(
  $$ select t.tablename from pg_tables t
     where t.schemaname = 'public'
       and not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = t.tablename) $$,
  'every public table has at least one RLS policy'
);

select * from finish();
rollback;
