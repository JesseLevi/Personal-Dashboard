-- Two-user isolation test for card_labels (ADR-0009 pattern, copied from
-- rls-profiles.sql). Sets up one card + one label + one attaching row per
-- user on their own auto-seeded default board first.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000005a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000005b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000005a", "role": "authenticated"}';
insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-00000000005a',
  (select id from public.board_columns where user_id = '00000000-0000-0000-0000-00000000005a' limit 1),
  'A''s card', 1000
);
insert into public.labels (user_id, board_id, name)
values (
  '00000000-0000-0000-0000-00000000005a',
  (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000005a' limit 1),
  'A''s label'
);
insert into public.card_labels (user_id, card_id, label_id)
values (
  '00000000-0000-0000-0000-00000000005a',
  (select id from public.cards where user_id = '00000000-0000-0000-0000-00000000005a' limit 1),
  (select id from public.labels where user_id = '00000000-0000-0000-0000-00000000005a' limit 1)
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000005b", "role": "authenticated"}';
insert into public.cards (user_id, column_id, title, position)
values (
  '00000000-0000-0000-0000-00000000005b',
  (select id from public.board_columns where user_id = '00000000-0000-0000-0000-00000000005b' limit 1),
  'B''s card', 1000
);
insert into public.labels (user_id, board_id, name)
values (
  '00000000-0000-0000-0000-00000000005b',
  (select id from public.boards where user_id = '00000000-0000-0000-0000-00000000005b' limit 1),
  'B''s label'
);
insert into public.card_labels (user_id, card_id, label_id)
values (
  '00000000-0000-0000-0000-00000000005b',
  (select id from public.cards where user_id = '00000000-0000-0000-0000-00000000005b' limit 1),
  (select id from public.labels where user_id = '00000000-0000-0000-0000-00000000005b' limit 1)
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000005a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.card_labels $$,
  $$ values (1) $$,
  'A sees exactly one card_labels row (their own)'
);
select results_eq(
  $$ select user_id from public.card_labels $$,
  $$ values ('00000000-0000-0000-0000-00000000005a'::uuid) $$,
  'the visible card_labels row belongs to A'
);
select is_empty(
  $$ update public.card_labels set label_id = label_id
     where user_id = '00000000-0000-0000-0000-00000000005b' returning id $$,
  'A cannot update B''s card_labels row'
);
select is_empty(
  $$ delete from public.card_labels
     where user_id = '00000000-0000-0000-0000-00000000005b' returning id $$,
  'A cannot delete B''s card_labels row'
);
select throws_ok(
  $$ insert into public.card_labels (user_id, card_id, label_id)
     values (
       '00000000-0000-0000-0000-00000000005b',
       (select id from public.cards where user_id = '00000000-0000-0000-0000-00000000005a' limit 1),
       (select id from public.labels where user_id = '00000000-0000-0000-0000-00000000005a' limit 1)
     ) $$,
  '42501',
  null,
  'A cannot insert a card_labels row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.card_labels $$,
  'anon sees no card_labels rows'
);

select * from finish();
rollback;
