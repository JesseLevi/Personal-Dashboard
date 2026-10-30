-- widget_tokens, private.widget_rate_events, the atlas_widget role and
-- public.widget_today (#654, ADR-0047 / ADR-0033 / ADR-0009).
-- Calendar sharing (ADR-0035) does not exist yet: calendar_role() is owner-only,
-- so no shared-calendar case is possible. widget_today reads through the same
-- policies as the app, so sharing will apply once calendar_role() grows it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-654000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-654000000002', 'b@test.local'),
       ('00000000-0000-0000-0000-654000000003', 'c@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-654000000001' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-654000000002' and is_default), true);

insert into public.calendar_events (user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-654000000001', current_setting('test.a_cal')::uuid,
        'A event', '2030-06-12 10:00Z', '2030-06-12 11:00Z'),
       ('00000000-0000-0000-0000-654000000002', current_setting('test.b_cal')::uuid,
        'B event', '2030-06-12 10:00Z', '2030-06-12 11:00Z');

-- Structure: role, ownership, grants.
select ok(
  (select not rolbypassrls and not rolcanlogin and rolinherit from pg_roles where rolname = 'atlas_widget'),
  'atlas_widget is nologin, inherit and does not bypass RLS'
);
select ok(pg_has_role('atlas_widget', 'authenticated', 'MEMBER'), 'atlas_widget is a member of authenticated');
select ok(
  not pg_has_role('atlas_widget', 'service_role', 'MEMBER'),
  'atlas_widget is not a member of service_role'
);
select is(
  (select pg_get_userbyid(proowner) from pg_proc
   where oid = 'public.widget_today(text,timestamptz,timestamptz,text)'::regprocedure),
  'atlas_widget', 'widget_today is owned by atlas_widget'
);
select ok(
  has_function_privilege('anon', 'public.widget_today(text,timestamptz,timestamptz,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.widget_today(text,timestamptz,timestamptz,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.widget_today(text,timestamptz,timestamptz,text)', 'EXECUTE')
  and not exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.widget_today(text,timestamptz,timestamptz,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'only anon (and the owner) can execute widget_today'
);
select ok(
  has_function_privilege('atlas_widget', 'private.widget_token_owner(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.widget_token_owner(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.widget_token_owner(text)', 'EXECUTE'),
  'only atlas_widget can execute widget_token_owner'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.widget_rate_events'::regclass)
  and not has_table_privilege('anon', 'private.widget_rate_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'private.widget_rate_events', 'SELECT,INSERT,UPDATE,DELETE'),
  'widget_rate_events has RLS and no client grants'
);
select ok(
  not has_table_privilege('anon', 'public.widget_tokens', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_column_privilege('authenticated', 'public.widget_tokens', 'token_hash', 'SELECT')
  and not has_column_privilege('authenticated', 'public.widget_tokens', 'token_hash', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.widget_tokens', 'last_used_at', 'UPDATE')
  and has_column_privilege('authenticated', 'public.widget_tokens', 'token_hash', 'INSERT'),
  'token_hash and last_used_at are not readable/updatable by authenticated; anon has nothing'
);

-- A creates a token; B creates one.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-654000000001", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.widget_tokens (label, token_hash)
     values ('Telefoon', encode(sha256(convert_to('atlas_wgt_tokenA', 'UTF8')), 'hex')) $$,
  'A can create a token'
);
select is((select user_id from public.widget_tokens where label = 'Telefoon'),
  '00000000-0000-0000-0000-654000000001'::uuid, 'user_id defaults to the caller');
select throws_ok($$ select token_hash from public.widget_tokens $$, '42501', null,
  'token_hash is not selectable by authenticated');
select throws_ok($$ update public.widget_tokens set token_hash = 'x' $$, '42501', null,
  'token_hash is not updatable by authenticated');
select throws_ok(
  $$ insert into public.widget_tokens (label, token_hash) values ('', 'h-empty') $$,
  '23514', null, 'an empty label is refused');

-- The 5-token limit.
select lives_ok(
  $$ insert into public.widget_tokens (label, token_hash)
     select 'extra ' || g, 'hash-extra-' || g from generate_series(1, 4) g $$,
  'A can create up to five tokens'
);
select throws_ok(
  $$ insert into public.widget_tokens (label, token_hash) values ('zesde', 'hash-sixth') $$,
  'P0001', 'widget token limit reached', 'the sixth token is refused'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-654000000002", "role": "authenticated"}';
insert into public.widget_tokens (label, token_hash)
values ('B toestel', encode(sha256(convert_to('atlas_wgt_tokenB', 'UTF8')), 'hex'));

select is((select count(*)::int from public.widget_tokens), 1, 'B sees only their own token');
select is_empty(
  $$ update public.widget_tokens set label = 'x' where label = 'Telefoon' returning 1 $$,
  'B cannot update A''s token');
select is_empty(
  $$ delete from public.widget_tokens where label = 'Telefoon' returning 1 $$,
  'B cannot delete A''s token');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-654000000001", "role": "authenticated"}';
select is((select count(*)::int from public.widget_tokens), 5, 'A sees only their own five tokens');

select throws_ok(
  $$ select public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC') $$,
  '42501', null, 'authenticated cannot execute widget_today');
select throws_ok($$ select * from private.widget_token_owner('x') $$, '42501', null,
  'authenticated cannot reach private.widget_token_owner');

-- widget_today as anon.
set local role anon;
set local request.jwt.claims to '{}';

select is(
  (select array_agg(i->>'title' order by i->>'title')
   from jsonb_array_elements(public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC')->'items') i),
  array['A event'], 'a token sees its owner''s items and not another member''s'
);
select is(
  public.widget_today('atlas_wgt_tokenB', '2030-06-10Z', '2030-06-17Z', 'UTC') #>> '{items,0,title}',
  'B event', 'B''s token sees B''s item'
);
select is(
  public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC') ->> 'locale',
  'nl', 'the response carries the owner''s locale'
);
select is(
  public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC') #>> '{items,0,calendar_id}',
  current_setting('test.a_cal'), 'items carry their calendar_id'
);
select ok(
  public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC') #> '{items,0}' ? 'color',
  'items carry the calendar colour key'
);
select is(
  public.widget_today('atlas_wgt_unknown', '2030-06-10Z', '2030-06-17Z', 'UTC'),
  '{"status": "unauthorized"}'::jsonb, 'an unknown token is unauthorized'
);
select is(
  public.widget_today(null, '2030-06-10Z', '2030-06-17Z', 'UTC'),
  '{"status": "unauthorized"}'::jsonb, 'a null token is unauthorized'
);
select throws_ok($$ select * from private.widget_rate_events $$, '42501', null,
  'anon cannot read private.widget_rate_events');
select throws_ok($$ select * from private.widget_token_owner('x') $$, '42501', null,
  'anon cannot call private.widget_token_owner');

-- last_used_at, deleted tokens.
reset role;
select ok(
  (select last_used_at is not null from public.widget_tokens where label = 'Telefoon'),
  'a successful call stamps last_used_at'
);
select ok(
  (select last_used_at is null from public.widget_tokens where label = 'extra 1'),
  'an unused token keeps last_used_at null'
);
delete from public.widget_tokens where label = 'Telefoon';
set local role anon;
set local request.jwt.claims to '{}';
select is(
  public.widget_today('atlas_wgt_tokenA', '2030-06-10Z', '2030-06-17Z', 'UTC'),
  '{"status": "unauthorized"}'::jsonb, 'a deleted token is unauthorized'
);

-- Rate limit: 120 per hour per token.
reset role;
insert into public.widget_tokens (user_id, label, token_hash)
values ('00000000-0000-0000-0000-654000000003', 'C', encode(sha256(convert_to('atlas_wgt_tokenC', 'UTF8')), 'hex'));
set local role anon;
set local request.jwt.claims to '{}';
select is(
  (select count(*) filter (where r->>'status' = 'ok')::int from (
     select public.widget_today('atlas_wgt_tokenC', '2030-06-10Z', '2030-06-17Z', 'UTC') as r
     from generate_series(1, 120)) s),
  120, '120 calls within an hour are allowed'
);
select is(
  public.widget_today('atlas_wgt_tokenC', '2030-06-10Z', '2030-06-17Z', 'UTC'),
  '{"status": "rate_limited"}'::jsonb, 'the 121st call within an hour is rate_limited'
);

reset role;
select is(
  (select count(*)::int from private.widget_rate_events
   where key = 'widget|' || (select id::text from public.widget_tokens where label = 'C')),
  120, 'a refused call records nothing'
);

select * from finish();
rollback;
