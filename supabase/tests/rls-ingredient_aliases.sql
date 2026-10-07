-- Two-user isolation test for ingredient_aliases (ADR-0009 pattern, copied
-- from rls-ingredients.sql, #312). Also asserts the table's stricter rule
-- that an alias may only point at the caller's own ingredient.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000010a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000010b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000010a", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000010a', 'A''s ui');
insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
values (
  '00000000-0000-0000-0000-00000000010a',
  'bosui',
  (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000010a' limit 1)
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000010b", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000010b', 'B''s ui');
insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
values (
  '00000000-0000-0000-0000-00000000010b',
  'lenteui',
  (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000010b' limit 1)
);

-- Stash B's real ingredient id (valid, resolvable) while acting as B, so the
-- cross-user ingredient checks below prove the policy rejects it and not
-- merely that RLS hid the lookup from A.
select set_config(
  'app.b_ingredient_id',
  (select id::text from public.ingredients where user_id = '00000000-0000-0000-0000-00000000010b' limit 1),
  true
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000010a", "role": "authenticated"}';

select results_eq(
  $$ select count(*)::int from public.ingredient_aliases $$,
  $$ values (1) $$,
  'A sees exactly one alias (their own)'
);
select results_eq(
  $$ select alias_normalized from public.ingredient_aliases $$,
  $$ values ('bosui') $$,
  'the visible alias is A''s own'
);
select is_empty(
  $$ select id from public.ingredient_aliases where user_id = '00000000-0000-0000-0000-00000000010b' $$,
  'A cannot read B''s alias'
);
select is_empty(
  $$ update public.ingredient_aliases set alias_normalized = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000010b' returning id $$,
  'A cannot update B''s alias'
);
select is_empty(
  $$ delete from public.ingredient_aliases
     where user_id = '00000000-0000-0000-0000-00000000010b' returning id $$,
  'A cannot delete B''s alias'
);
select throws_ok(
  $$ insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
     values (
       '00000000-0000-0000-0000-00000000010b',
       'sneaky',
       (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000010a' limit 1)
     ) $$,
  '42501',
  null,
  'A cannot insert an alias for B'
);
select throws_ok(
  $$ insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
     values (
       '00000000-0000-0000-0000-00000000010a',
       'sneaky',
       current_setting('app.b_ingredient_id')::uuid
     ) $$,
  '42501',
  null,
  'A cannot alias to B''s ingredient'
);
select throws_ok(
  $$ update public.ingredient_aliases
     set ingredient_id = current_setting('app.b_ingredient_id')::uuid
     where user_id = '00000000-0000-0000-0000-00000000010a' $$,
  '42501',
  null,
  'A cannot repoint their alias to B''s ingredient'
);
select throws_ok(
  $$ insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
     values (
       '00000000-0000-0000-0000-00000000010a',
       'bosui',
       (select id from public.ingredients where user_id = '00000000-0000-0000-0000-00000000010a' limit 1)
     ) $$,
  '23505',
  null,
  'the same alias twice for one user violates the unique constraint'
);
select isnt_empty(
  $$ update public.ingredient_aliases set alias_normalized = 'bosuitje'
     where user_id = '00000000-0000-0000-0000-00000000010a' returning id $$,
  'A can update their own alias'
);
select isnt_empty(
  $$ delete from public.ingredient_aliases
     where user_id = '00000000-0000-0000-0000-00000000010a' returning id $$,
  'A can delete their own alias'
);

-- Anonymous sees nothing.
set local role anon;
set local request.jwt.claims to '{}';
select is_empty(
  $$ select id from public.ingredient_aliases $$,
  'anon sees no aliases'
);

select * from finish();
rollback;
