-- Two-user isolation test for labels (ADR-0009 pattern, copied from
-- rls-profiles.sql). Labels aren't seeded, so this inserts one label per
-- user on their own auto-seeded default board first.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000004a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000004b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000004a", "role": "authenticated"}';
insert into public.labels (user_id, board_id, name)
values (
  '00000000-0000-0000-0000-00000000004a',
  (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000004a' limit 1),
  'A''s label'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000004b", "role": "authenticated"}';
insert into public.labels (user_id, board_id, name)
values (
  '00000000-0000-0000-0000-00000000004b',
  (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000004b' limit 1),
  'B''s label'
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000004a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.labels $$,
  $$ values (1) $$,
  'A sees exactly one label (their own)'
);
select results_eq(
  $$ select name from public.labels $$,
  $$ values ('A''s label') $$,
  'the visible label is A''s own'
);
select is_empty(
  $$ update public.labels set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000004b' returning id $$,
  'A cannot update B''s label'
);
select is_empty(
  $$ delete from public.labels
     where user_id = '00000000-0000-0000-0000-00000000004b' returning id $$,
  'A cannot delete B''s label'
);
select throws_ok(
  $$ insert into public.labels (user_id, board_id, name)
     values (
       '00000000-0000-0000-0000-00000000004b',
       (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000004a' limit 1),
       'sneaky label'
     ) $$,
  '42501',
  null,
  'A cannot insert a label for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.labels $$,
  'anon sees no labels'
);

select * from finish();
rollback;
