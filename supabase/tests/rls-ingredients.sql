-- Two-user isolation test for ingredients (ADR-0009 pattern, copied from
-- rls-profiles.sql). ADR-0011 §2: per-user ingredient list, reference_id
-- left null here since it is unrelated to RLS isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000006a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000006b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000006a", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000006a', 'A''s havermout');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000006b", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000006b', 'B''s havermout');

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000006a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.ingredients $$,
  $$ values (1) $$,
  'A sees exactly one ingredient (their own)'
);
select results_eq(
  $$ select user_id from public.ingredients $$,
  $$ values ('00000000-0000-0000-0000-00000000006a'::uuid) $$,
  'the visible ingredient belongs to A'
);
select is_empty(
  $$ update public.ingredients set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000006b' returning id $$,
  'A cannot update B''s ingredient'
);
select is_empty(
  $$ delete from public.ingredients
     where user_id = '00000000-0000-0000-0000-00000000006b' returning id $$,
  'A cannot delete B''s ingredient'
);
select throws_ok(
  $$ insert into public.ingredients (user_id, name)
     values ('00000000-0000-0000-0000-00000000006b', 'sneaky ingredient') $$,
  '42501',
  null,
  'A cannot insert an ingredient for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.ingredients $$,
  'anon sees no ingredients'
);

select * from finish();
rollback;
