-- #577 (ADR-0043 §10): search_semantic and search_text, plus the trigram
-- indexes search_text needs. Both are security invoker and return only
-- (source_type, source_id, score); the app resolves titles and links.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- notes already has title and content_text trigram indexes (20260813000001).
create index if not exists recipes_title_trgm_idx
  on public.recipes using gin (title extensions.gin_trgm_ops);
create index if not exists cards_title_trgm_idx
  on public.cards using gin (title extensions.gin_trgm_ops);
create index if not exists cards_description_trgm_idx
  on public.cards using gin (description extensions.gin_trgm_ops);
create index if not exists calendar_events_title_trgm_idx
  on public.calendar_events using gin (title extensions.gin_trgm_ops);
create index if not exists calendar_events_location_trgm_idx
  on public.calendar_events using gin (location extensions.gin_trgm_ops);
create index if not exists calendar_events_description_trgm_idx
  on public.calendar_events using gin (description extensions.gin_trgm_ops);
create index if not exists shopping_list_items_name_trgm_idx
  on public.shopping_list_items using gin (name extensions.gin_trgm_ops);

-- Cosine similarity (1 - distance) of the best chunk per source. The owner
-- filter is explicit as well as through RLS.
create function public.search_semantic(
  p_query extensions.halfvec(1024),
  p_types text[],
  p_match_count integer
)
returns table (source_type text, source_id uuid, score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.source_type, r.source_id, r.score
  from (
    select t.source_type, t.source_id, t.score,
           pg_catalog.row_number() over (
             partition by t.source_type, t.source_id order by t.score desc
           ) as rn
    from (
      select case
               when e.note_id is not null then 'note'
               when e.recipe_id is not null then 'recipe'
               when e.card_id is not null then 'card'
               when e.calendar_event_id is not null then 'calendar_event'
               else 'shopping_list_item'
             end as source_type,
             coalesce(e.note_id, e.recipe_id, e.card_id, e.calendar_event_id, e.shopping_list_item_id) as source_id,
             (1 - (e.embedding operator(extensions.<=>) p_query))::double precision as score
      from public.embeddings e
      where e.user_id = (select auth.uid())
    ) t
    where p_types is null or t.source_type = any (p_types)
  ) r
  where r.rn = 1
  order by r.score desc, r.source_id
  limit least(greatest(coalesce(p_match_count, 20), 1), 100)
$$;

-- Substring match (ilike, served by the trigram indexes) scored by
-- word_similarity: title hits outrank body hits. Rows come through RLS only,
-- so items on a basket shared with the caller are searchable, as in the app.
create function public.search_text(
  p_query text,
  p_types text[],
  p_match_count integer
)
returns table (source_type text, source_id uuid, score double precision)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q text := pg_catalog.btrim(coalesce(p_query, ''));
  v_pattern text;
begin
  if pg_catalog.length(v_q) < 2 or pg_catalog.length(v_q) > 200 then
    return;
  end if;
  v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
    v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select r.source_type, r.source_id, r.score
  from (
    select 'note'::text as source_type, n.id as source_id,
           greatest(
             extensions.word_similarity(v_q, n.title),
             0.8 * extensions.word_similarity(v_q, n.content_text)
           )::double precision as score
    from public.notes n
    where (p_types is null or 'note' = any (p_types))
      and (n.title ilike v_pattern or n.content_text ilike v_pattern)
    union all
    select 'recipe', rc.id,
           extensions.word_similarity(v_q, rc.title)::double precision
    from public.recipes rc
    where (p_types is null or 'recipe' = any (p_types))
      and rc.title ilike v_pattern
    union all
    select 'card', c.id,
           greatest(
             extensions.word_similarity(v_q, c.title),
             0.8 * extensions.word_similarity(v_q, coalesce(c.description, ''))
           )::double precision
    from public.cards c
    where (p_types is null or 'card' = any (p_types))
      and (c.title ilike v_pattern or c.description ilike v_pattern)
    union all
    select 'calendar_event', ev.id,
           greatest(
             extensions.word_similarity(v_q, ev.title),
             0.8 * extensions.word_similarity(v_q, coalesce(ev.location, '')),
             0.8 * extensions.word_similarity(v_q, coalesce(ev.description, ''))
           )::double precision
    from public.calendar_events ev
    where (p_types is null or 'calendar_event' = any (p_types))
      and (ev.title ilike v_pattern or ev.location ilike v_pattern or ev.description ilike v_pattern)
    union all
    select 'shopping_list_item', s.id,
           extensions.word_similarity(v_q, s.name)::double precision
    from public.shopping_list_items s
    where (p_types is null or 'shopping_list_item' = any (p_types))
      and s.name ilike v_pattern
  ) r
  order by r.score desc, r.source_id
  limit least(greatest(coalesce(p_match_count, 20), 1), 100);
end;
$$;

comment on function public.search_semantic is
  'Best chunk per source by cosine similarity, owner only (ADR-0043 §10).';
comment on function public.search_text is
  'Keyword search over notes, recipes, cards, events and basket items, scored (ADR-0043 §10).';

revoke execute on function public.search_semantic(extensions.halfvec, text[], integer) from public, anon;
grant execute on function public.search_semantic(extensions.halfvec, text[], integer) to authenticated, service_role;
revoke execute on function public.search_text(text, text[], integer) from public, anon;
grant execute on function public.search_text(text, text[], integer) to authenticated, service_role;
