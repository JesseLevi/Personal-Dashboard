-- Two-user isolation test for recipe_tags (ADR-0009 pattern, copied from
-- rls-card_labels.sql). Sets up one recipe + one tag + one attaching row per
-- user on their own auto-seeded default category first.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000fa', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000fb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000fa", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000fa',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000fa' limit 1),
  'A''s recipe', 2
);
insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-0000000000fa', 'A''s tag');
insert into public.recipe_tags (user_id, recipe_id, tag_id)
values (
  '00000000-0000-0000-0000-0000000000fa',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000fa' limit 1),
  (select id from public.tags where user_id = '00000000-0000-0000-0000-0000000000fa' limit 1)
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000fb", "role": "authenticated"}';
insert into public.recipes (user_id, category_id, title, servings)
values (
  '00000000-0000-0000-0000-0000000000fb',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-0000000000fb' limit 1),
  'B''s recipe', 4
);
insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-0000000000fb', 'B''s tag');
insert into public.recipe_tags (user_id, recipe_id, tag_id)
values (
  '00000000-0000-0000-0000-0000000000fb',
  (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000fb' limit 1),
  (select id from public.tags where user_id = '00000000-0000-0000-0000-0000000000fb' limit 1)
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000fa", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.recipe_tags $$,
  $$ values (1) $$,
  'A sees exactly one recipe_tags row (their own)'
);
select results_eq(
  $$ select user_id from public.recipe_tags $$,
  $$ values ('00000000-0000-0000-0000-0000000000fa'::uuid) $$,
  'the visible recipe_tags row belongs to A'
);
select is_empty(
  $$ update public.recipe_tags set tag_id = tag_id
     where user_id = '00000000-0000-0000-0000-0000000000fb' returning id $$,
  'A cannot update B''s recipe_tags row'
);
select is_empty(
  $$ delete from public.recipe_tags
     where user_id = '00000000-0000-0000-0000-0000000000fb' returning id $$,
  'A cannot delete B''s recipe_tags row'
);
select throws_ok(
  $$ insert into public.recipe_tags (user_id, recipe_id, tag_id)
     values (
       '00000000-0000-0000-0000-0000000000fb',
       (select id from public.recipes where user_id = '00000000-0000-0000-0000-0000000000fa' limit 1),
       (select id from public.tags where user_id = '00000000-0000-0000-0000-0000000000fa' limit 1)
     ) $$,
  '42501',
  null,
  'A cannot insert a recipe_tags row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipe_tags $$,
  'anon sees no recipe_tags rows'
);

select * from finish();
rollback;
