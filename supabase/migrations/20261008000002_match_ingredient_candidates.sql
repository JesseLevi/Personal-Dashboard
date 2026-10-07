-- #316 (epic #309, ADR-0019 §2): trigram candidates for the import matcher.
-- One round trip serves a whole recipe: p_names is the array of normalized
-- ingredient names (normalizeIngredientName in lib/recipes/import/
-- match-ingredients.ts); input_index is the 0-based position in that array.
--
-- Searches the caller's own public.ingredients and the shared
-- reference.ingredients (name_nl and name_en). A reference row the caller has
-- already adopted (an own row with reference_id = r.id) is dropped, so the
-- same ingredient is never offered twice and the own row wins.
--
-- Scoring is extensions.similarity() (pg_trgm, enabled in
-- 20260813000001_note_schema.sql, schema `extensions`). No trigram index is
-- added: a gin_trgm_ops index only serves the `%` filter operator, and we
-- need a per-name score. The searched set is the user's own ingredients plus
-- the reference table (low thousands of rows), which a sequential scan
-- covers in milliseconds even for a 40-line recipe. Revisit if the reference
-- table or recipe size grows by an order of magnitude.
--
-- security invoker: RLS on public.ingredients scopes own rows; the explicit
-- user_id filter is defence in depth. Reference rows are readable by every
-- signed-in user (select-only grant).

create function public.match_ingredient_candidates(
  p_names text[],
  p_limit int default 5
) returns table (
  input_index int,
  source text,
  id uuid,
  name text,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with names as (
    select (n.ord - 1)::int as idx, n.val as q
    from unnest(p_names) with ordinality as n(val, ord)
    where n.val is not null and n.val <> ''
  ),
  own as (
    select i.id, i.name, i.reference_id
    from public.ingredients i
    where i.user_id = (select auth.uid())
  ),
  scored as (
    select nm.idx, 'own'::text as source, o.id, o.name,
           extensions.similarity(lower(o.name), nm.q) as score
    from names nm
    cross join own o
    union all
    -- NEVO names look like "Appel, rauw": also score the part before the
    -- first comma, so "appel" is not penalised for the cooking-state suffix.
    select nm.idx, 'reference'::text, r.id, r.name_nl,
           greatest(
             extensions.similarity(lower(r.name_nl), nm.q),
             extensions.similarity(lower(split_part(r.name_nl, ',', 1)), nm.q),
             coalesce(extensions.similarity(lower(r.name_en), nm.q), 0),
             coalesce(extensions.similarity(lower(split_part(r.name_en, ',', 1)), nm.q), 0)
           )
    from names nm
    cross join reference.ingredients r
    where not exists (select 1 from own o where o.reference_id = r.id)
  ),
  ranked as (
    select s.idx, s.source, s.id, s.name, s.score,
           row_number() over (
             partition by s.idx
             order by s.score desc, s.source asc, s.name asc
           ) as rn
    from scored s
    where s.score >= 0.2
  )
  select rk.idx, rk.source, rk.id, rk.name, rk.score::real
  from ranked rk
  where rk.rn <= least(greatest(p_limit, 1), 20)
  order by rk.idx, rk.rn;
$$;

comment on function public.match_ingredient_candidates(text[], int) is
  'Top-N trigram candidates per normalized name over the caller''s own '
  'ingredients and reference.ingredients (#316). source is ''own'' or '
  '''reference''; ties prefer own. Floor 0.2 keeps noise out of the result.';

revoke all on function public.match_ingredient_candidates(text[], int) from public, anon;
grant execute on function public.match_ingredient_candidates(text[], int) to authenticated, service_role;
