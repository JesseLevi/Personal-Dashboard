-- #312: recipe import columns and the replace_recipe_contents needs_review
-- round-trip. Single user; cross-user isolation of recipes /
-- recipe_ingredients is covered by their own rls-*.sql files.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000011a', 'a@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000011a", "role": "authenticated"}';

insert into public.recipes (user_id, category_id, title, servings, position)
values (
  '00000000-0000-0000-0000-00000000011a',
  (select id from public.recipe_categories where user_id = '00000000-0000-0000-0000-00000000011a' limit 1),
  'Manual recipe', 2, 1000
);

select results_eq(
  $$ select import_status::text, import_error, source_url from public.recipes $$,
  $$ values ('done', null::text, null::text) $$,
  'a recipe inserted without import fields defaults to done, no error, no source_url'
);
select throws_ok(
  $$ update public.recipes set import_error = 'timeout' $$,
  '23514',
  null,
  'import_error is rejected unless import_status is failed'
);
select throws_ok(
  $$ update public.recipes set import_status = 'failed', import_error = 'Time Out!' $$,
  '23514',
  null,
  'import_error must be a lowercase snake_case code'
);
select lives_ok(
  $$ update public.recipes set import_status = 'failed', import_error = 'timeout',
       source_url = 'https://example.com/r' $$,
  'a failed import with reason code timeout is accepted'
);
select results_eq(
  $$ select count(*)::int from public.recipes where import_status = 'importing' $$,
  $$ values (0) $$,
  'no recipe is importing'
);

select lives_ok(
  $$ select public.replace_recipe_contents(
       (select id from public.recipes limit 1),
       '[{"name": "ui", "quantity": 1, "unit": "stuk", "needsReview": true},
         {"name": "ei", "quantity": 2, "unit": "stuk"}]'::jsonb,
       '[]'::jsonb
     ) $$,
  'replace_recipe_contents accepts lines with and without needsReview'
);
select results_eq(
  $$ select name, needs_review from public.recipe_ingredients order by position $$,
  $$ values ('ui'::text, true), ('ei'::text, false) $$,
  'needsReview round-trips; absent defaults to false'
);

set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.recipes $$,
  'anon sees no recipes'
);

select * from finish();
rollback;
