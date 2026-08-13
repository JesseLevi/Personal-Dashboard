-- Two-user isolation test for notes (ADR-0009 pattern, copied from
-- rls-recipes.sql). Each user's note uses their own auto-seeded default
-- category (seed_default_note_categories()) as its category_id FK target.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000001ba', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000001bb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000001ba", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
values (
  '00000000-0000-0000-0000-0000000001ba',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-0000000001ba' limit 1),
  'A''s note', 1000
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000001bb", "role": "authenticated"}';
insert into public.notes (user_id, category_id, title, position)
values (
  '00000000-0000-0000-0000-0000000001bb',
  (select id from public.note_categories where user_id = '00000000-0000-0000-0000-0000000001bb' limit 1),
  'B''s note', 1000
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000001ba", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.notes $$,
  $$ values (1) $$,
  'A sees exactly one note (their own)'
);
select results_eq(
  $$ select title from public.notes $$,
  $$ values ('A''s note') $$,
  'the visible note is A''s own'
);
select is_empty(
  $$ update public.notes set title = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000001bb' returning id $$,
  'A cannot update B''s note'
);
select is_empty(
  $$ delete from public.notes
     where user_id = '00000000-0000-0000-0000-0000000001bb' returning id $$,
  'A cannot delete B''s note'
);
select throws_ok(
  $$ insert into public.notes (user_id, category_id, title, position)
     values (
       '00000000-0000-0000-0000-0000000001bb',
       (select id from public.note_categories where user_id = '00000000-0000-0000-0000-0000000001ba' limit 1),
       'sneaky note', 5000
     ) $$,
  '42501',
  null,
  'A cannot insert a note for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.notes $$,
  'anon sees no notes'
);

select * from finish();
rollback;
