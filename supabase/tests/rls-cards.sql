-- Two-user isolation test for cards (ADR-0009 pattern, copied from
-- rls-profiles.sql). Cards aren't seeded, so this inserts one card per user
-- into their own auto-seeded default board first.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000003a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000003b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000003a", "role": "authenticated"}';
insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-00000000003a',
  (select id from public.board_columns where user_id = '00000000-0000-0000-0000-00000000003a' limit 1),
  'A''s card', 1000
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000003b", "role": "authenticated"}';
insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-00000000003b',
  (select id from public.board_columns where user_id = '00000000-0000-0000-0000-00000000003b' limit 1),
  'B''s card', 1000
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000003a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.cards $$,
  $$ values (1) $$,
  'A sees exactly one card (their own)'
);
select results_eq(
  $$ select title from public.cards $$,
  $$ values ('A''s card') $$,
  'the visible card is A''s own'
);
select is_empty(
  $$ update public.cards set title = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000003b' returning id $$,
  'A cannot update B''s card'
);
select is_empty(
  $$ delete from public.cards
     where user_id = '00000000-0000-0000-0000-00000000003b' returning id $$,
  'A cannot delete B''s card'
);
select throws_ok(
  $$ insert into public.cards (user_id, column_id, title, position)
     values (
       '00000000-0000-0000-0000-00000000003b',
       (select id from public.board_columns where user_id = '00000000-0000-0000-0000-00000000003a' limit 1),
       'sneaky card', 5000
     ) $$,
  '42501',
  null,
  'A cannot insert a card for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.cards $$,
  'anon sees no cards'
);

select * from finish();
rollback;
