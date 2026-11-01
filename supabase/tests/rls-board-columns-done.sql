-- Done columns (ADR-0050, 20261102000004_board_columns_is_done.sql): the seed
-- marks "Afgerond", agenda_items leaves finished cards out, and is_done stays
-- under board_columns' RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-500000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-500000000002', 'b@test.local');

select is(
  (select array_agg(name order by position) from public.board_columns
   where user_id = '00000000-0000-0000-0000-500000000001' and is_done),
  array['Afgerond'],
  'the default board has exactly one done column, Afgerond'
);

select set_config('test.open_col', (select id::text from public.board_columns
  where user_id = '00000000-0000-0000-0000-500000000001' and not is_done order by position limit 1), true);
select set_config('test.done_col', (select id::text from public.board_columns
  where user_id = '00000000-0000-0000-0000-500000000001' and is_done limit 1), true);

insert into public.cards (id, user_id, column_id, title, position, planned_for, due_at)
values
  ('00000000-0000-0000-0000-500000000e01', '00000000-0000-0000-0000-500000000001',
   current_setting('test.open_col')::uuid, 'Open', 1000, '2030-06-14', '2030-06-15 10:00Z'),
  ('00000000-0000-0000-0000-500000000e02', '00000000-0000-0000-0000-500000000001',
   current_setting('test.done_col')::uuid, 'Done', 1000, '2030-06-14', '2030-06-15 10:00Z');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-500000000001", "role": "authenticated"}';

select results_eq(
  $$ select kind, title from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
     where kind in ('planned_card', 'deadline') order by kind, title $$,
  $$ values ('deadline'::text, 'Open'::text), ('planned_card'::text, 'Open'::text) $$,
  'agenda_items leaves cards in a done column out, planned and deadline alike'
);

update public.board_columns set is_done = false where id = current_setting('test.done_col')::uuid;
select is(
  (select count(*)::int from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
   where kind in ('planned_card', 'deadline')),
  4,
  'clearing the flag brings the cards back'
);

update public.board_columns set is_done = true where id = current_setting('test.open_col')::uuid;
select is(
  (select is_done from public.board_columns where id = current_setting('test.open_col')::uuid),
  true,
  'the owner can mark a column done'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-500000000002", "role": "authenticated"}';
select is_empty(
  $$ update public.board_columns set is_done = false
     where id = current_setting('test.open_col')::uuid returning id $$,
  'another member cannot change the flag'
);
select is_empty(
  $$ select 1 from public.agenda_items('2030-06-10 00:00Z', '2030-06-17 00:00Z', 'UTC')
     where kind in ('planned_card', 'deadline') $$,
  'another member sees none of the cards'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-500000000001", "role": "authenticated"}';
select is(
  (select is_done from public.board_columns where id = current_setting('test.open_col')::uuid),
  true,
  'the flag survived the other member''s attempt'
);

reset role;
select col_default_is('public', 'board_columns', 'is_done', 'false', 'is_done defaults to false');

select * from finish();
rollback;
