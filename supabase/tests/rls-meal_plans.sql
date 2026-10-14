-- Two-user isolation + cascade test for meal_plans, shopping_list_items.meal_plan_id
-- and cards.planned_for (#483, ADR-0037 / ADR-0035 / ADR-0009).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-483000000201', 'a@test.local'),
       ('00000000-0000-0000-0000-483000000202', 'b@test.local');

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000201' and is_default), true);
select set_config('test.b_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-483000000202' and is_default), true);

insert into public.recipes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-483000000211', '00000000-0000-0000-0000-483000000201',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-483000000201' limit 1),
        'A pasta', 1000),
       ('00000000-0000-0000-0000-483000000212', '00000000-0000-0000-0000-483000000201',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-483000000201' limit 1),
        'A soep', 1000),
       ('00000000-0000-0000-0000-483000000213', '00000000-0000-0000-0000-483000000202',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-483000000202' limit 1),
        'B curry', 1000);

insert into public.calendars (id, user_id, name)
values ('00000000-0000-0000-0000-483000000221', '00000000-0000-0000-0000-483000000201', 'Tweede');
insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-483000000231', '00000000-0000-0000-0000-483000000201',
        current_setting('test.a_cal')::uuid, 'Etentje', now(), now() + interval '2 hours'),
       ('00000000-0000-0000-0000-483000000232', '00000000-0000-0000-0000-483000000201',
        '00000000-0000-0000-0000-483000000221', 'Elders', now(), now() + interval '2 hours'),
       ('00000000-0000-0000-0000-483000000233', '00000000-0000-0000-0000-483000000201',
        current_setting('test.a_cal')::uuid, 'Weg te halen', now(), now() + interval '2 hours');

insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on)
values ('00000000-0000-0000-0000-483000000241', '00000000-0000-0000-0000-483000000202',
        current_setting('test.b_cal')::uuid, '00000000-0000-0000-0000-483000000213', 2, 'dinner', current_date);

insert into public.cards (id, user_id, column_id, title, position)
values ('00000000-0000-0000-0000-483000000251', '00000000-0000-0000-0000-483000000201',
        (select id from public.board_columns where user_id = '00000000-0000-0000-0000-483000000201' limit 1),
        'A kaart', 1000);

select col_type_is('public', 'cards', 'planned_for', 'date', 'cards.planned_for is a date');
select col_is_null('public', 'cards', 'planned_for', 'cards.planned_for is nullable');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-483000000201", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000242', '00000000-0000-0000-0000-483000000201',
             current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-483000000211',
             4, 'dinner', current_date + 1) returning id $$,
  'A can plan a recipe on a day'
);
select lives_ok(
  $$ insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
     values ('00000000-0000-0000-0000-483000000243', '00000000-0000-0000-0000-483000000201',
             current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-483000000211',
             2, 'snack', '00000000-0000-0000-0000-483000000231') returning id $$,
  'A can attach a recipe to an event of the same calendar'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on, calendar_event_id)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 2, 'lunch', current_date,
             '00000000-0000-0000-0000-483000000231') $$,
  '23514',
  null,
  'a plan cannot have both a day and an event'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 2, 'lunch') $$,
  '23514',
  null,
  'a plan needs a day or an event'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 2, 'brunch', current_date) $$,
  '23514',
  null,
  'an unknown slot is rejected'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 0, 'lunch', current_date) $$,
  '23514',
  null,
  'servings must be positive'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000213', 2, 'dinner', current_date) $$,
  '42501',
  null,
  'A cannot plan B''s recipe'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.b_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 2, 'dinner', current_date) $$,
  '42501',
  null,
  'A cannot plan into B''s calendar'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
     values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
             '00000000-0000-0000-0000-483000000211', 2, 'dinner',
             '00000000-0000-0000-0000-483000000232') $$,
  '42501',
  null,
  'a plan cannot attach to an event of another calendar'
);
select is((select count(*)::int from public.meal_plans), 2, 'A sees only their own plans');
select is_empty(
  $$ select 1 from public.meal_plans where id = '00000000-0000-0000-0000-483000000241' $$,
  'A cannot read B''s plan'
);
select is_empty(
  $$ update public.meal_plans set servings = 9
     where id = '00000000-0000-0000-0000-483000000241' returning id $$,
  'A cannot update B''s plan'
);
select is_empty(
  $$ delete from public.meal_plans
     where id = '00000000-0000-0000-0000-483000000241' returning id $$,
  'A cannot delete B''s plan'
);
select lives_ok(
  $$ insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on)
     values ('00000000-0000-0000-0000-483000000244', '00000000-0000-0000-0000-483000000202',
             current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-483000000212',
             1, 'lunch', current_date) $$,
  'a wrong user_id on insert is overwritten by the calendar owner'
);
select is(
  (select user_id from public.meal_plans where id = '00000000-0000-0000-0000-483000000244'),
  '00000000-0000-0000-0000-483000000201'::uuid,
  'plans carry the calendar owner as user_id'
);
select lives_ok(
  $$ update public.meal_plans set servings = 6, slot = 'lunch'
     where id = '00000000-0000-0000-0000-483000000242' $$,
  'A can change servings and slot of their plan'
);
select throws_ok(
  $$ update public.meal_plans set recipe_id = '00000000-0000-0000-0000-483000000212'
     where id = '00000000-0000-0000-0000-483000000242' $$,
  '42501',
  null,
  'the recipe of a plan cannot be swapped'
);

-- cards.planned_for is writable by the owner.
select lives_ok(
  $$ update public.cards set planned_for = current_date + 3
     where id = '00000000-0000-0000-0000-483000000251' $$,
  'A can set planned_for on their own card'
);

-- A basket item remembers its plan; deleting the plan only clears the pointer.
insert into public.shopping_list_items (user_id, name, position, meal_plan_id)
values ('00000000-0000-0000-0000-483000000201', 'Pasta', 1000,
        '00000000-0000-0000-0000-483000000242');
delete from public.meal_plans where id = '00000000-0000-0000-0000-483000000242';
select is(
  (select meal_plan_id from public.shopping_list_items where name = 'Pasta'),
  null,
  'deleting a plan nulls meal_plan_id on its basket items'
);
select is(
  (select count(*)::int from public.shopping_list_items where name = 'Pasta'),
  1,
  'the basket item itself stays'
);

-- Deleting an event removes its attached plans, not the recipe.
insert into public.meal_plans (user_id, calendar_id, recipe_id, servings, slot, calendar_event_id)
values ('00000000-0000-0000-0000-483000000201', current_setting('test.a_cal')::uuid,
        '00000000-0000-0000-0000-483000000211', 2, 'dinner', '00000000-0000-0000-0000-483000000233');
delete from public.calendar_events where id = '00000000-0000-0000-0000-483000000233';
select is(
  (select count(*)::int from public.meal_plans where calendar_event_id = '00000000-0000-0000-0000-483000000233'),
  0,
  'deleting an event cascades its attached plans'
);
select is(
  (select count(*)::int from public.recipes where id = '00000000-0000-0000-0000-483000000211'),
  1,
  'deleting an event does not delete the recipe'
);

-- Deleting a recipe removes its plans.
delete from public.recipes where id = '00000000-0000-0000-0000-483000000212';
select is(
  (select count(*)::int from public.meal_plans where recipe_id = '00000000-0000-0000-0000-483000000212'),
  0,
  'deleting a recipe cascades its plans'
);

set local role anon;
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select id from public.meal_plans $$,
  '42501',
  null,
  'anon has no access to meal_plans'
);

select * from finish();
rollback;
