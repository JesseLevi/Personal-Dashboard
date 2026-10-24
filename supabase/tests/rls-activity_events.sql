-- activity_events (#582, ADR-0044): isolation, no client writes, the basket
-- triggers (also in a shared basket), settle_cooked_meals and function grants.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-582000000001', 'a@test.local'),
       ('00000000-0000-0000-0000-582000000002', 'b@test.local'),
       ('00000000-0000-0000-0000-582000000003', 'c@test.local');

insert into public.shopping_lists (id, user_id, name, position)
values ('00000000-0000-0000-0000-582000000f01', '00000000-0000-0000-0000-582000000001', 'Feest', 2000);
insert into public.shares (user_id, member_id, shopping_list_id, status)
values ('00000000-0000-0000-0000-582000000001', '00000000-0000-0000-0000-582000000002',
        '00000000-0000-0000-0000-582000000f01', 'accepted');

insert into public.recipes (id, user_id, category_id, title, position)
values ('00000000-0000-0000-0000-582000000d01', '00000000-0000-0000-0000-582000000001',
        (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-582000000001' limit 1),
        'A pasta', 1000);

select set_config('test.a_cal', (select id::text from public.calendars
  where user_id = '00000000-0000-0000-0000-582000000001' and is_default), true);

insert into public.calendar_events (id, user_id, calendar_id, title, starts_at, ends_at)
values ('00000000-0000-0000-0000-582000000e01', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, 'Eten eerder', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
       ('00000000-0000-0000-0000-582000000e02', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, 'Eten later', now() + interval '2 days', now() + interval '2 days' + interval '1 hour');

insert into public.meal_plans (id, user_id, calendar_id, recipe_id, servings, slot, planned_on, calendar_event_id)
values ('00000000-0000-0000-0000-582000000c01', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-582000000d01', 2, 'dinner', current_date - 3, null),
       ('00000000-0000-0000-0000-582000000c02', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-582000000d01', 2, 'dinner', current_date + 3, null),
       ('00000000-0000-0000-0000-582000000c03', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-582000000d01', 2, 'dinner', null,
        '00000000-0000-0000-0000-582000000e01'),
       ('00000000-0000-0000-0000-582000000c04', '00000000-0000-0000-0000-582000000001',
        current_setting('test.a_cal')::uuid, '00000000-0000-0000-0000-582000000d01', 2, 'dinner', null,
        '00000000-0000-0000-0000-582000000e02');

select is(private.activity_item_key('  Pinda   Kaas '), 'pinda kaas', 'item_key lowers, trims and collapses whitespace');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-582000000001", "role": "authenticated"}';

insert into public.shopping_list_items (id, user_id, name, quantity, unit, position)
values ('00000000-0000-0000-0000-582000000a01', '00000000-0000-0000-0000-582000000001', 'Pindakaas ', 1, 'stuk', 1000);

select results_eq(
  $$ select kind, item_key, item_name, quantity::int, unit::text from public.activity_events
     where shopping_list_item_id = '00000000-0000-0000-0000-582000000a01' $$,
  $$ values ('basket_item_added', 'pindakaas', 'Pindakaas ', 1, 'stuk') $$,
  'adding an item logs basket_item_added'
);

update public.shopping_list_items set checked = true where id = '00000000-0000-0000-0000-582000000a01';
select is(
  (select count(*)::int from public.activity_events
   where shopping_list_item_id = '00000000-0000-0000-0000-582000000a01' and kind = 'basket_item_checked'),
  1, 'checking an item logs basket_item_checked'
);

update public.shopping_list_items set quantity = 2 where id = '00000000-0000-0000-0000-582000000a01';
select is((select count(*)::int from public.activity_events
  where shopping_list_item_id = '00000000-0000-0000-0000-582000000a01'), 2,
  'other updates log nothing');

update public.shopping_list_items set checked = false where id = '00000000-0000-0000-0000-582000000a01';
select results_eq(
  $$ select kind from public.activity_events where shopping_list_item_id = '00000000-0000-0000-0000-582000000a01' $$,
  $$ values ('basket_item_added') $$,
  'unchecking removes the checked event and keeps the added one'
);

update public.shopping_list_items set checked = true where id = '00000000-0000-0000-0000-582000000a01';
update public.shopping_list_items set checked = false where id = '00000000-0000-0000-0000-582000000a01';
update public.shopping_list_items set checked = true where id = '00000000-0000-0000-0000-582000000a01';
select is((select count(*)::int from public.activity_events
  where shopping_list_item_id = '00000000-0000-0000-0000-582000000a01' and kind = 'basket_item_checked'),
  1, 'check, uncheck, check leaves one checked event');

delete from public.shopping_list_items where id = '00000000-0000-0000-0000-582000000a01';
select results_eq(
  $$ select kind, shopping_list_item_id is null from public.activity_events order by kind $$,
  $$ values ('basket_item_added', true), ('basket_item_checked', true) $$,
  'deleting an item keeps its history, unlinked'
);

-- Shared basket: the editor's actions land on the owner.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-582000000002", "role": "authenticated"}';
insert into public.shopping_list_items (id, user_id, list_id, name, position)
values ('00000000-0000-0000-0000-582000000a02', '00000000-0000-0000-0000-582000000002',
        '00000000-0000-0000-0000-582000000f01', 'Chips', 1000);
update public.shopping_list_items set checked = true where id = '00000000-0000-0000-0000-582000000a02';
select is((select count(*)::int from public.activity_events), 0, 'the editor sees no history');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-582000000001", "role": "authenticated"}';
select results_eq(
  $$ select kind, user_id::text from public.activity_events where item_key = 'chips' order by kind $$,
  $$ values ('basket_item_added', '00000000-0000-0000-0000-582000000001'),
            ('basket_item_checked', '00000000-0000-0000-0000-582000000001') $$,
  'events in a shared basket belong to the owner'
);

-- Clearing a basket is not a purchase.
select is((select count(*)::int from public.activity_events), 4, 'owner has four events before clearing');
delete from public.shopping_list_items where list_id = '00000000-0000-0000-0000-582000000f01';
select is((select count(*)::int from public.activity_events), 4, 'deleting items logs nothing');

-- Clients cannot write.
select throws_ok(
  $$ insert into public.activity_events (user_id, kind, item_key)
     values ('00000000-0000-0000-0000-582000000001', 'basket_item_added', 'x') $$,
  '42501', null, 'authenticated cannot insert');
select throws_ok(
  $$ update public.activity_events set item_key = 'x' $$,
  '42501', null, 'authenticated cannot update');

-- Settle.
select is(public.settle_cooked_meals(), 2, 'settle writes the two past meals (date and attached event)');
select is(public.settle_cooked_meals(), 0, 'settle is idempotent');
select results_eq(
  $$ select meal_plan_id::text from public.activity_events where kind = 'recipe_cooked' order by meal_plan_id $$,
  $$ values ('00000000-0000-0000-0000-582000000c01'), ('00000000-0000-0000-0000-582000000c03') $$,
  'only meals whose day has passed count'
);
select is(
  (select occurred_at from public.activity_events where meal_plan_id = '00000000-0000-0000-0000-582000000c03'),
  (select starts_at from public.calendar_events where id = '00000000-0000-0000-0000-582000000e01'),
  'an attached plan takes the event time'
);

-- Isolation.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-582000000003", "role": "authenticated"}';
select is((select count(*)::int from public.activity_events), 0, 'a stranger sees no events');
select is(public.settle_cooked_meals(), 0, 'a stranger settles nothing');
select is_empty(
  $$ delete from public.activity_events returning id $$,
  'a stranger deletes nothing');
select throws_ok(
  $$ select public.settle_cooked_meals_for('00000000-0000-0000-0000-582000000001') $$,
  '42501', null, 'authenticated cannot call settle_cooked_meals_for');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-582000000001", "role": "authenticated"}';
select lives_ok(
  $$ delete from public.activity_events where kind = 'recipe_cooked' $$,
  'the owner can delete their events');

-- Anonymous.
set local role anon;
set local request.jwt.claims to '{}';
select throws_ok($$ select count(*) from public.activity_events $$, '42501', null, 'anon has no table access');
select throws_ok($$ select public.settle_cooked_meals() $$, '42501', null, 'anon cannot call settle_cooked_meals');

-- Grants.
reset role;
select ok(
  has_function_privilege('service_role', 'public.settle_cooked_meals_for(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.settle_cooked_meals_for(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.settle_cooked_meals_for(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.settle_cooked_meals()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.settle_cooked_meals()', 'EXECUTE'),
  'settle_cooked_meals_for is service_role only; settle_cooked_meals is for authenticated'
);
select ok(
  not has_function_privilege('authenticated', 'private.settle_cooked_meals(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.activity_item_key(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.shopping_list_items_log_activity()', 'EXECUTE'),
  'the private helpers are not executable by clients'
);

select * from finish();
rollback;
