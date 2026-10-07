-- Tests for public.match_ingredient_candidates (#316, 20261008000002) and for
-- the alias upsert the matcher's server action performs. ADR-0009 pattern for
-- an RPC, same shape as rls-move-rpcs.sql: the caller sees only their own
-- ingredients plus shared reference rows, never another user's.
-- Reference seed rows used: 'Halloumi' (20260730000001_ingredient_library.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000316a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000316b', 'b@test.local');

set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000316a", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000316a', 'Zxcvbnmwortel');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000316b", "role": "authenticated"}';
insert into public.ingredients (user_id, name)
values ('00000000-0000-0000-0000-00000000316b', 'Qwertyplant');
-- B's real, resolvable ingredient id, stashed while acting as B so the
-- cross-user alias check below proves the policy and not a hidden lookup.
select set_config(
  'app.b_ingredient_id',
  (select id::text from public.ingredients where user_id = '00000000-0000-0000-0000-00000000316b' limit 1),
  true
);

-- Act as user A.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000316a", "role": "authenticated"}';

select results_eq(
  $$ select input_index, source, name from public.match_ingredient_candidates(array['zxcvbnmwortel']) $$,
  $$ values (0, 'own', 'Zxcvbnmwortel') $$,
  'A finds their own ingredient by name'
);
select is_empty(
  $$ select 1 from public.match_ingredient_candidates(array['qwertyplant']) $$,
  'A never gets B''s ingredient as a candidate'
);
select results_eq(
  $$ select input_index, source, name, score = 1 from public.match_ingredient_candidates(array['halloumi']) $$,
  $$ values (0, 'reference', 'Halloumi', true) $$,
  'a reference ingredient is returned as source reference with its own id'
);
select results_eq(
  $$ select input_index from public.match_ingredient_candidates(array['', 'zxcvbnmwortel', null]) $$,
  $$ values (1) $$,
  'input_index is the 0-based array position; empty and null names are skipped'
);
select cmp_ok(
  (select count(*)::int from public.match_ingredient_candidates(array['a'], 3)),
  '<=', 3,
  'p_limit caps the candidates per name'
);

-- Adopting a reference ingredient hides its reference row (own wins).
insert into public.ingredients (user_id, name, reference_id)
values ('00000000-0000-0000-0000-00000000316a', 'Halloumi',
        (select id from reference.ingredients where name_nl = 'Halloumi'));
select results_eq(
  $$ select source from public.match_ingredient_candidates(array['halloumi']) $$,
  $$ values ('own') $$,
  'an adopted reference ingredient is offered once, as the own row'
);

-- --- Alias upsert (what upsertAlias in match-ingredients.ts does) ---
insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
values ('00000000-0000-0000-0000-00000000316a', 'bosui',
        (select id from public.ingredients where name = 'Zxcvbnmwortel'));
select lives_ok(
  $$ insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
     values ('00000000-0000-0000-0000-00000000316a', 'bosui',
             (select id from public.ingredients where name = 'Halloumi'))
     on conflict (user_id, alias_normalized)
     do update set ingredient_id = excluded.ingredient_id $$,
  'A can upsert their own alias onto another own ingredient'
);
select results_eq(
  $$ select i.name from public.ingredient_aliases a
     join public.ingredients i on i.id = a.ingredient_id
     where a.alias_normalized = 'bosui' $$,
  $$ values ('Halloumi') $$,
  'the upsert repointed the alias instead of adding a second row'
);
select throws_ok(
  $$ insert into public.ingredient_aliases (user_id, alias_normalized, ingredient_id)
     values ('00000000-0000-0000-0000-00000000316a', 'bosui',
             current_setting('app.b_ingredient_id')::uuid)
     on conflict (user_id, alias_normalized)
     do update set ingredient_id = excluded.ingredient_id $$,
  '42501',
  null,
  'A cannot upsert an alias onto B''s ingredient'
);

-- --- Grants ---
select ok(
  has_function_privilege('authenticated', 'public.match_ingredient_candidates(text[], int)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.match_ingredient_candidates(text[], int)', 'EXECUTE'),
  'authenticated and service_role can execute the function'
);

set local role anon;
set local request.jwt.claims to '{}';
select ok(
  not has_function_privilege('anon', 'public.match_ingredient_candidates(text[], int)', 'EXECUTE'),
  'anon has no EXECUTE on the function'
);
select throws_ok(
  $$ select * from public.match_ingredient_candidates(array['halloumi']) $$,
  '42501',
  null,
  'anon calling the function is refused by the grant'
);

select * from finish();
rollback;
