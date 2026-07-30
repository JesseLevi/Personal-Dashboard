-- Two-user isolation test for tags (ADR-0009 pattern, copied from
-- rls-profiles.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000ea', 'a@test.local'),
       ('00000000-0000-0000-0000-0000000000eb', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';
insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-0000000000ea', 'A''s tag');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000eb", "role": "authenticated"}';
insert into public.tags (user_id, name)
values ('00000000-0000-0000-0000-0000000000eb', 'B''s tag');

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000ea", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.tags $$,
  $$ values (1) $$,
  'A sees exactly one tag (their own)'
);
select results_eq(
  $$ select name from public.tags $$,
  $$ values ('A''s tag') $$,
  'the visible tag is A''s own'
);
select is_empty(
  $$ update public.tags set name = 'hacked'
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot update B''s tag'
);
select is_empty(
  $$ delete from public.tags
     where user_id = '00000000-0000-0000-0000-0000000000eb' returning id $$,
  'A cannot delete B''s tag'
);
select throws_ok(
  $$ insert into public.tags (user_id, name)
     values ('00000000-0000-0000-0000-0000000000eb', 'sneaky tag') $$,
  '42501',
  null,
  'A cannot insert a tag for B'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.tags $$,
  'anon sees no tags'
);

select * from finish();
rollback;
