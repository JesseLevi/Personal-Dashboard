-- Two-user isolation test for shopping_list_items (ADR-0009 pattern, copied
-- from rls-recipe_categories.sql). Standalone rows -- recipe_id is a
-- nullable provenance link only, so no recipe/category setup is needed
-- first, unlike rls-recipe_steps.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ea', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000eb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';
insert into public.shopping_list_items (user_id, name, quantity, unit, position)
values ('00000000-0000-0000-0000-0000000000ea', 'A''s melk', 1, 'liter', 1000);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000eb", "role": "authenticated"}';
insert into public.shopping_list_items (user_id, name, quantity, unit, position)
values ('00000000-0000-0000-0000-0000000000eb', 'B''s brood', 1, 'stuk', 1000);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.shopping_list_items $$,
  $$ values (1) $$,
  'A sees exactly one shopping_list_items row (their own)'
);
select results_eq(
  $$ select name from public.shopping_list_items $$,
  $$ values ('A''s melk') $$,
  'the visible shopping_list_items row is A''s own'
);
select is_empty(
  $$ update public.shopping_list_items set checked = true
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot update B''s shopping_list_items row'
);
select is_empty(
  $$ delete from public.shopping_list_items
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot delete B''s shopping_list_items row'
);
select throws_ok(
  $$ insert into public.shopping_list_items (user_id, name, position)
     values ('00000000-0000-0000-0000-0000000000eb', 'sneaky item', 2000) $$,
  '42501',
  null,
  'A cannot insert a shopping_list_items row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.shopping_list_items $$,
  'anon sees no shopping_list_items rows'
);

select * from finish();
rollback;
