-- Two-user isolation test for shopping_lists (#422, ADR-0009 / ADR-0035):
-- ownership policies, the undeletable default list, the item trigger that
-- keeps old inserts (no list_id) working, and the list_id backfill result.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- The signup trigger seeds one default list per user.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-4000000000aa', 'a@test.local'),
       ('00000000-0000-0000-0000-4000000000ab', 'b@test.local');

select is(
  (select count(*)::int from public.shopping_lists
   where user_id = '00000000-0000-0000-0000-4000000000aa' and is_default),
  1,
  'signup seeds exactly one default list'
);
select throws_ok(
  $$ insert into public.shopping_lists (user_id, is_default)
     values ('00000000-0000-0000-0000-4000000000aa', true) $$,
  '23505',
  null,
  'a second default list for the same user is rejected'
);
select col_not_null('public', 'shopping_list_items', 'list_id',
  'every shopping_list_items row has a list_id (backfill left none behind)');
select is(
  (select count(*)::int from public.shopping_list_items where list_id is null),
  0,
  'no shopping_list_items row without list_id'
);

select set_config('test.b_list', (select id::text from public.shopping_lists
  where user_id = '00000000-0000-0000-0000-4000000000ab' and is_default), true);

set local role authenticated;

-- B owns an item on their default list.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-4000000000ab", "role": "authenticated"}';
insert into public.shopping_list_items (user_id, name, position)
values ('00000000-0000-0000-0000-4000000000ab', 'B''s brood', 1000);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-4000000000aa", "role": "authenticated"}';

select is((select count(*)::int from public.shopping_lists), 1, 'A sees only their own list');
select is_empty(
  $$ select 1 from public.shopping_lists where user_id = '00000000-0000-0000-0000-4000000000ab' $$,
  'A cannot read B''s list'
);
select is_empty(
  $$ update public.shopping_lists set name = 'gekaapt'
     where user_id = '00000000-0000-0000-0000-4000000000ab' returning id $$,
  'A cannot update B''s list'
);
select is_empty(
  $$ delete from public.shopping_lists
     where user_id = '00000000-0000-0000-0000-4000000000ab' returning id $$,
  'A cannot delete B''s list'
);
select throws_ok(
  $$ insert into public.shopping_lists (user_id, name)
     values ('00000000-0000-0000-0000-4000000000ab', 'sneaky') $$,
  '42501',
  null,
  'A cannot create a list for B'
);
select throws_ok(
  $$ insert into public.shopping_lists (user_id, name, is_default)
     values ('00000000-0000-0000-0000-4000000000aa', 'tweede standaard', true) $$,
  '42501',
  null,
  'a client cannot create a default list'
);
select throws_ok(
  $$ update public.shopping_lists set is_default = false $$,
  '42501',
  null,
  'a client cannot flip is_default'
);
select is_empty(
  $$ delete from public.shopping_lists where is_default returning id $$,
  'the default list cannot be deleted'
);

-- Own non-default list: create, rename, delete.
insert into public.shopping_lists (user_id, name, position)
values ('00000000-0000-0000-0000-4000000000aa', 'Feestje', 2000);
select lives_ok(
  $$ update public.shopping_lists set name = 'Verjaardag' where name = 'Feestje' $$,
  'A can rename their own non-default list'
);

-- Items: an insert without list_id lands on the default list (old code path).
insert into public.shopping_list_items (user_id, name, position)
values ('00000000-0000-0000-0000-4000000000aa', 'A''s melk', 1000);
select is(
  (select l.is_default from public.shopping_list_items i
   join public.shopping_lists l on l.id = i.list_id where i.name = 'A''s melk'),
  true,
  'an item inserted without list_id goes to the default list'
);

-- An item on the second list gets that list's owner as user_id.
insert into public.shopping_list_items (user_id, list_id, name, position)
select user_id, id, 'A''s taart', 1000 from public.shopping_lists where name = 'Verjaardag';
select is(
  (select user_id from public.shopping_list_items where name = 'A''s taart'),
  '00000000-0000-0000-0000-4000000000aa'::uuid,
  'items carry the list owner as user_id'
);

select is((select count(*)::int from public.shopping_list_items), 2, 'A sees only their own items');
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, list_id, name, position)
     values ('00000000-0000-0000-0000-4000000000aa',
             current_setting('test.b_list')::uuid, 'sneaky', 1) $$,
  '42501',
  null,
  'A cannot add an item to B''s list'
);

-- Deleting a non-default list takes its items with it.
delete from public.shopping_lists where name = 'Verjaardag';
select is(
  (select count(*)::int from public.shopping_list_items where name = 'A''s taart'),
  0,
  'deleting a list cascades to its items'
);

-- Act as B: nothing of A's is visible or writable.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-4000000000ab", "role": "authenticated"}';
select is((select count(*)::int from public.shopping_list_items), 1, 'B sees only their own item');
select is_empty(
  $$ update public.shopping_list_items set checked = true
     where name = 'A''s melk' returning id $$,
  'B cannot update A''s item'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty($$ select id from public.shopping_lists $$, 'anon sees no lists');

select * from finish();
rollback;
