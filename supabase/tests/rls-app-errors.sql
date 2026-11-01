-- public.report_app_error + private.app_errors (ADR-0049). The table lives
-- outside `public`, so check-rls-coverage.sh does not see it; its isolation is
-- asserted here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(
  has_function_privilege('anon', 'public.report_app_error(text, text, text, text, text, text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.report_app_error(text, text, text, text, text, text, text)', 'EXECUTE'),
  'only anon can execute report_app_error'
);
select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.report_app_error(text,text,text,text,text,text,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE on report_app_error'
);
select ok(
  not has_table_privilege('anon', 'private.app_errors', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'private.app_errors', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon and authenticated have no table privileges on app_errors'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.app_errors'::regclass),
  'RLS is enabled on app_errors'
);
select hasnt_column('private', 'app_errors', 'user_id', 'app_errors carries no user_id');

-- No secret configured: every call is a no-op.
set local role anon;
select public.report_app_error('anything-goes-here-1234', '/x', 'GET', 'render', null, 'Error', 'boom');
reset role;
select is((select count(*)::int from private.app_errors), 0, 'without a Vault secret nothing is stored');

select vault.create_secret('test-secret-0123456789abcdef', 'app_error_report_secret');

set local role anon;
select public.report_app_error('wrong-secret-0123456789', '/x', 'GET', 'render', null, 'Error', 'boom');
reset role;
select is((select count(*)::int from private.app_errors), 0, 'a wrong secret stores nothing');

set local role anon;
select public.report_app_error(
  'test-secret-0123456789abcdef', '/notities/[noteId]?q=private', 'post', 'action', 'd1',
  'TypeError', repeat('m', 500));
reset role;
select is((select count(*)::int from private.app_errors), 1, 'the right secret stores one row');
select is((select route from private.app_errors), '/notities/[noteId]', 'the query string is dropped');
select is((select method from private.app_errors), 'POST', 'the method is upper-cased');
select is((select length(message) from private.app_errors), 300, 'the message is truncated to 300');

set local role anon;
select public.report_app_error('test-secret-0123456789abcdef', '/r', 'GET', 'render', null, 'Error', 'x')
from generate_series(1, 80);
reset role;
select is((select count(*)::int from private.app_errors), 60, 'at most 60 rows per minute');

select * from finish();
rollback;
