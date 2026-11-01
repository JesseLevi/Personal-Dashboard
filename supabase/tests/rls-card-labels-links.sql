-- Label links (ADR-0052, 20261101000004_card_labels_same_board.sql): the owner
-- links and unlinks their own card and label on one board; never across
-- boards or users. Isolation itself: rls-card_labels.sql / rls-labels.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-52000000000a', 'a@test.local'),
       ('00000000-0000-0000-0000-52000000000b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-52000000000b", "role": "authenticated"}';
insert into public.cards (user_id, column_id, title, position)
values ('00000000-0000-0000-0000-52000000000b',
  (select id from public.board_columns where user_id = '00000000-0000-0000-0000-52000000000b' order by position limit 1),
  'B card', 1000);
select set_config('test.b_card', (select id::text from public.cards limit 1), true);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-52000000000a", "role": "authenticated"}';
select set_config('test.a_board', (select id::text from public.boards limit 1), true);
insert into public.cards (user_id, column_id, title, position)
values ('00000000-0000-0000-0000-52000000000a',
  (select id from public.board_columns order by position limit 1), 'A card', 1000);
select set_config('test.a_card', (select id::text from public.cards limit 1), true);
insert into public.labels (user_id, board_id, name)
values ('00000000-0000-0000-0000-52000000000a', current_setting('test.a_board')::uuid, 'werk');
select set_config('test.a_label', (select id::text from public.labels where name = 'werk'), true);

insert into public.boards (user_id, name, position)
values ('00000000-0000-0000-0000-52000000000a', 'Ander bord', 2000);
insert into public.labels (user_id, board_id, name)
values ('00000000-0000-0000-0000-52000000000a',
  (select id from public.boards where name = 'Ander bord'), 'elders');
select set_config('test.a_other_label', (select id::text from public.labels where name = 'elders'), true);

select lives_ok(
  $$ insert into public.card_labels (user_id, card_id, label_id)
     values ('00000000-0000-0000-0000-52000000000a',
       current_setting('test.a_card')::uuid, current_setting('test.a_label')::uuid) $$,
  'the owner links a label of the same board'
);
select throws_ok(
  $$ insert into public.card_labels (user_id, card_id, label_id)
     values ('00000000-0000-0000-0000-52000000000a',
       current_setting('test.a_card')::uuid, current_setting('test.a_other_label')::uuid) $$,
  '42501', null,
  'a label of another board cannot be linked'
);
select throws_ok(
  $$ insert into public.card_labels (user_id, card_id, label_id)
     values ('00000000-0000-0000-0000-52000000000a',
       current_setting('test.b_card')::uuid, current_setting('test.a_label')::uuid) $$,
  '42501', null,
  'a label cannot be linked to another member''s card'
);
select throws_ok(
  $$ update public.card_labels set label_id = current_setting('test.a_other_label')::uuid
     where card_id = current_setting('test.a_card')::uuid $$,
  '42501', null,
  'an existing link cannot be moved to another board''s label'
);
select lives_ok(
  $$ delete from public.card_labels where card_id = current_setting('test.a_card')::uuid $$,
  'the owner unlinks'
);
select is_empty(
  $$ select 1 from public.card_labels where card_id = current_setting('test.a_card')::uuid $$,
  'the link is gone'
);
select throws_ok(
  $$ insert into public.labels (user_id, board_id, name)
     values ('00000000-0000-0000-0000-52000000000a', current_setting('test.a_board')::uuid, repeat('x', 41)) $$,
  '23514', null,
  'a label name is at most 40 characters'
);

select * from finish();
rollback;
