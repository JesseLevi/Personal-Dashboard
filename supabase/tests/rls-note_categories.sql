-- Two-user isolation test for note_categories (ADR-0009 pattern, copied
-- from rls-recipe_categories.sql). Not seeded manually here:
-- seed_default_note_categories() fires on auth.users insert, so each user
-- already has three categories (Overig/Werk/Sport) before the assertions
-- below run.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000001aa', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000001ab', 'b@test.local');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000001aa", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.note_categories $$,
  $$ values (3) $$,
  'A sees exactly three note_categories (their own seeded set)'
);
select results_eq(
  $$ select count(*)::int from public.note_categories
     where user_id = '00000000-0000-0000-0000-0000000001aa' $$,
  $$ values (3) $$,
  'all visible note_categories belong to A'
);
select is_empty(
  $$ update public.note_categories set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000001ab' returning id $$,
  'A cannot update B''s note_categories'
);
select is_empty(
  $$ delete from public.note_categories
     where user_id = '00000000-0000-0000-0000-0000000001ab' returning id $$,
  'A cannot delete B''s note_categories'
);
select throws_ok(
  $$ insert into public.note_categories (user_id, name, icon, position)
     values ('00000000-0000-0000-0000-0000000001ab', 'sneaky', 'FolderClosed', 4000) $$,
  '42501',
  null,
  'A cannot insert a note_categories row for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.note_categories $$,
  'anon sees no note_categories'
);

select * from finish();
rollback;
