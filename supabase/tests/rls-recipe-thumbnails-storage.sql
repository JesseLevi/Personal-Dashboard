-- Two-user object test for the `recipe-thumbnails` bucket (ADR-0009: "Storage
-- buckets get the same two-user object test" as a public table). Pattern
-- copied from rls-recipes.sql, scoped to storage.objects + bucket_id
-- instead of a public table. The bucket row itself comes from
-- 20260801000001_recipe_thumbnails_storage.sql, already applied by the time
-- `supabase db reset` runs this file.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ca', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000cb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}';
insert into storage.objects (bucket_id, name)
values ('recipe-thumbnails', '00000000-0000-0000-0000-0000000000ca/a.jpg');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000cb", "role": "authenticated"}';
insert into storage.objects (bucket_id, name)
values ('recipe-thumbnails', '00000000-0000-0000-0000-0000000000cb/b.jpg');

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from storage.objects where bucket_id = 'recipe-thumbnails' $$,
  $$ values (1) $$,
  'A sees exactly one recipe-thumbnails object (their own)'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'recipe-thumbnails' $$,
  $$ values ('00000000-0000-0000-0000-0000000000ca/a.jpg') $$,
  'the visible object is A''s own'
);
select is_empty(
  $$ update storage.objects set metadata = '{"touched": true}'::jsonb
     where bucket_id = 'recipe-thumbnails'
       and name = '00000000-0000-0000-0000-0000000000cb/b.jpg'
     returning id $$,
  'A cannot update B''s object'
);
select is_empty(
  $$ delete from storage.objects
     where bucket_id = 'recipe-thumbnails'
       and name = '00000000-0000-0000-0000-0000000000cb/b.jpg'
     returning id $$,
  'A cannot delete B''s object'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('recipe-thumbnails', '00000000-0000-0000-0000-0000000000cb/sneaky.jpg') $$,
  '42501',
  null,
  'A cannot insert an object under B''s path prefix'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from storage.objects where bucket_id = 'recipe-thumbnails' $$,
  'anon sees no recipe-thumbnails objects'
);

select * from finish();
rollback;
