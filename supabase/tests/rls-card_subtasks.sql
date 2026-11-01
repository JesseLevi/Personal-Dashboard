-- Two-user isolation test for card_subtasks and public.promote_card_subtask
-- (ADR-0053, 20261102000001_card_subtasks.sql), ADR-0009 pattern.
--
-- Fixtures are seeded as the table owner so cards can be backdated: the touch
-- trigger only moves cards.updated_at forward from before now(), and now() is
-- fixed inside this transaction. The touch trigger is switched off while the
-- seed subtasks are inserted, so those cards stay backdated too.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-20000000001a', 'a@test.local'),
       ('00000000-0000-0000-0000-20000000001b', 'b@test.local');

-- One column per user (the auto-seeded board's first column).
create temporary table fixture_columns on commit drop as
  select distinct on (user_id) user_id, id as column_id
  from public.board_columns
  where user_id in ('00000000-0000-0000-0000-20000000001a', '00000000-0000-0000-0000-20000000001b')
  order by user_id, position;

insert into public.cards (user_id, column_id, title, position, updated_at)
select f.user_id, f.column_id, c.title, c.position, now() - interval '1 hour'
from fixture_columns f
join (values
  ('00000000-0000-0000-0000-20000000001a'::uuid, 'A1', 1000),
  ('00000000-0000-0000-0000-20000000001a'::uuid, 'A2', 2000),
  ('00000000-0000-0000-0000-20000000001a'::uuid, 'A3', 3000),
  ('00000000-0000-0000-0000-20000000001a'::uuid, 'A5', 4000),
  ('00000000-0000-0000-0000-20000000001a'::uuid, 'A6', 5000),
  ('00000000-0000-0000-0000-20000000001b'::uuid, 'B1', 1000)
) as c (user_id, title, position) on c.user_id = f.user_id;

alter table public.card_subtasks disable trigger card_subtasks_touch_card;
insert into public.card_subtasks (user_id, card_id, title, position)
values
  ('00000000-0000-0000-0000-20000000001a', (select id from public.cards where title = 'A1'), 'promote me', 1000),
  ('00000000-0000-0000-0000-20000000001a', (select id from public.cards where title = 'A3'), 'delete me', 1000),
  ('00000000-0000-0000-0000-20000000001a', (select id from public.cards where title = 'A5'), 'move me', 1000),
  ('00000000-0000-0000-0000-20000000001b', (select id from public.cards where title = 'B1'), 'B subtask', 1000);
alter table public.card_subtasks enable trigger card_subtasks_touch_card;

select set_config('app.a1', (select id::text from public.cards where title = 'A1'), true);
select set_config('app.a2', (select id::text from public.cards where title = 'A2'), true);
select set_config('app.a3', (select id::text from public.cards where title = 'A3'), true);
select set_config('app.a5', (select id::text from public.cards where title = 'A5'), true);
select set_config('app.a6', (select id::text from public.cards where title = 'A6'), true);
select set_config('app.b1', (select id::text from public.cards where title = 'B1'), true);
select set_config('app.a_promote', (select id::text from public.card_subtasks where title = 'promote me'), true);
select set_config('app.a_delete', (select id::text from public.card_subtasks where title = 'delete me'), true);
select set_config('app.a_move', (select id::text from public.card_subtasks where title = 'move me'), true);
select set_config('app.b_sub', (select id::text from public.card_subtasks where title = 'B subtask'), true);
select set_config('app.a_column', (select column_id::text from fixture_columns where user_id = '00000000-0000-0000-0000-20000000001a'), true);

select ok(
  has_table_privilege('service_role', 'public.card_subtasks', 'select')
  and not has_table_privilege('anon', 'public.card_subtasks', 'select')
  and not has_table_privilege('anon', 'public.card_subtasks', 'insert'),
  'service_role may select card_subtasks, anon holds nothing'
);

set local role authenticated;

-- --- User B ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-20000000001b", "role": "authenticated"}';

select is_empty(
  $$ select id from public.card_subtasks where id = current_setting('app.a_promote')::uuid $$,
  'B cannot see A''s subtask'
);
select throws_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001b', current_setting('app.a1')::uuid, 'x', 2000) $$,
  '42501',
  null,
  'B cannot insert a subtask on A''s card, even with B''s own user_id'
);
select is_empty(
  $$ update public.card_subtasks set title = 'hijacked'
     where id = current_setting('app.a_promote')::uuid returning id $$,
  'B cannot update A''s subtask'
);
select is_empty(
  $$ delete from public.card_subtasks where id = current_setting('app.a_promote')::uuid returning id $$,
  'B cannot delete A''s subtask'
);
select throws_ok(
  $$ update public.card_subtasks set card_id = current_setting('app.a1')::uuid
     where id = current_setting('app.b_sub')::uuid $$,
  '42501',
  null,
  'B cannot move their own subtask onto A''s card'
);
select throws_ok(
  $$ select public.promote_card_subtask(current_setting('app.a_promote')::uuid) $$,
  'MV404',
  null,
  'B cannot promote A''s subtask'
);
select lives_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001b', current_setting('app.b1')::uuid, 'B second', 2000) $$,
  'B can add a subtask to B''s own card'
);

-- --- User A ---
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-20000000001a", "role": "authenticated"}';

select is_empty(
  $$ select id from public.card_subtasks where user_id = '00000000-0000-0000-0000-20000000001b' $$,
  'A cannot see B''s subtasks'
);
select lives_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001a', current_setting('app.a1')::uuid, 'owner insert', 2000) $$,
  'A can add a subtask to A''s own card'
);
select ok(
  (select updated_at = now() from public.cards where id = current_setting('app.a1')::uuid),
  'inserting a subtask bumps the parent''s updated_at'
);
select throws_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001b', current_setting('app.a1')::uuid, 'x', 3000) $$,
  '42501',
  null,
  'A cannot insert a subtask for B'
);
select throws_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001a', current_setting('app.b1')::uuid, 'x', 3000) $$,
  '42501',
  null,
  'A cannot attach a subtask to B''s card'
);
select throws_ok(
  $$ update public.card_subtasks set card_id = current_setting('app.b1')::uuid
     where id = current_setting('app.a_promote')::uuid $$,
  '42501',
  null,
  'A cannot move a subtask onto B''s card'
);
select throws_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001a', current_setting('app.a1')::uuid, '   ', 3000) $$,
  '23514',
  null,
  'a blank title is refused'
);
select throws_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001a', current_setting('app.a1')::uuid, repeat('x', 201), 3000) $$,
  '23514',
  null,
  'a title over 200 characters is refused'
);

select lives_ok(
  $$ update public.card_subtasks set card_id = current_setting('app.a6')::uuid
     where id = current_setting('app.a_move')::uuid $$,
  'A can move a subtask between A''s own cards'
);
select ok(
  (select count(*) = 2 from public.cards
   where id in (current_setting('app.a5')::uuid, current_setting('app.a6')::uuid) and updated_at = now()),
  'moving a subtask bumps both the old and the new parent'
);

select lives_ok(
  $$ delete from public.card_subtasks where id = current_setting('app.a_delete')::uuid $$,
  'A can delete A''s subtask'
);
select ok(
  (select updated_at = now() from public.cards where id = current_setting('app.a3')::uuid),
  'deleting a subtask bumps the parent''s updated_at'
);

select lives_ok(
  $$ insert into public.card_subtasks (user_id, card_id, title, position)
     values ('00000000-0000-0000-0000-20000000001a', current_setting('app.a2')::uuid, 'cascades', 1000) $$,
  'A adds a subtask to the card that is deleted next'
);
delete from public.cards where id = current_setting('app.a2')::uuid;
select is_empty(
  $$ select id from public.card_subtasks where card_id = current_setting('app.a2')::uuid $$,
  'deleting a card deletes its subtasks'
);

-- --- promote_card_subtask ---
select set_config(
  'app.promoted',
  (select public.promote_card_subtask(current_setting('app.a_promote')::uuid))::text,
  true
);
select ok(
  (select c.title = 'promote me'
      and c.column_id = current_setting('app.a_column')::uuid
      and c.user_id = '00000000-0000-0000-0000-20000000001a'
      and c.priority = 'medium'
      and c.position = (select max(o.position) + 1000 from public.cards o
                        where o.column_id = c.column_id and o.id <> c.id)
   from public.cards c where c.id = current_setting('app.promoted')::uuid),
  'promote creates a card in the parent''s column, at the end, with the default priority'
);
select is_empty(
  $$ select id from public.card_subtasks where id = current_setting('app.a_promote')::uuid $$,
  'promote deletes the subtask'
);

-- --- anon ---
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.card_subtasks $$,
  '42501',
  null,
  'anon cannot read card_subtasks'
);
select throws_ok(
  $$ select public.promote_card_subtask(current_setting('app.b_sub')::uuid) $$,
  '42501',
  null,
  'anon cannot execute promote_card_subtask'
);

select * from finish();
rollback;
