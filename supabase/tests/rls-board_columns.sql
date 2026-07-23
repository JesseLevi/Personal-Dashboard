-- Two-user isolation test for board_columns (ADR-0009 pattern, copied from
-- rls-profiles.sql). Both users get their board's 4 default columns the
-- moment they're inserted into auth.users (seed_default_board trigger).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000002a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000002b', 'b@test.local');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000002a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.board_columns $$,
  $$ values (4) $$,
  'A sees exactly their own board''s 4 seeded columns'
);
select results_eq(
  $$ select count(distinct user_id)::int from public.board_columns $$,
  $$ values (1) $$,
  'every visible column belongs to A'
);
select is_empty(
  $$ update public.board_columns set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000002b' returning id $$,
  'A cannot update B''s column'
);
select is_empty(
  $$ delete from public.board_columns
     where user_id = '00000000-0000-0000-0000-00000000002b' returning id $$,
  'A cannot delete B''s column'
);
select throws_ok(
  $$ insert into public.board_columns (user_id, board_id, name, icon, position)
     values (
       '00000000-0000-0000-0000-00000000002b',
       (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000002a' limit 1),
       'sneaky column', 'Lightbulb', 5000
     ) $$,
  '42501',
  null,
  'A cannot insert a column for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.board_columns $$,
  'anon sees no columns'
);

select * from finish();
rollback;
