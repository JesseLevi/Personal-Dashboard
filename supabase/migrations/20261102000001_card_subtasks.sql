-- ADR-0053 (#693): a card with subtasks is a project. A subtask is a title and
-- a check, nothing else. Owner-only like cards; sharing would extend these
-- policies through role functions (ADR-0035).
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create table public.card_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  done boolean not null default false,
  -- Same fractional scheme as cards.position. No reorder UI in v1.
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.card_subtasks is
  'Subtasks of a card (ADR-0053). The 50-per-card cap lives in the addSubtasks action.';

create trigger card_subtasks_set_updated_at
  before update on public.card_subtasks
  for each row execute function public.set_updated_at();

create index card_subtasks_user_id_idx on public.card_subtasks (user_id);
create index card_subtasks_card_id_idx on public.card_subtasks (card_id);
-- Keyword search matches subtask titles (search_text below), like cards_title_trgm_idx.
create index card_subtasks_title_trgm_idx
  on public.card_subtasks using gin (title extensions.gin_trgm_ops);

alter table public.card_subtasks enable row level security;

-- Insert and update also require the card to be the caller's own: a subtask
-- cannot be attached to someone else's card, nor moved onto one.
create policy card_subtasks_select_own on public.card_subtasks
  for select using (user_id = (select auth.uid()));
create policy card_subtasks_insert_own on public.card_subtasks
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.cards c
      where c.id = card_subtasks.card_id and c.user_id = (select auth.uid())
    )
  );
create policy card_subtasks_update_own on public.card_subtasks
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.cards c
      where c.id = card_subtasks.card_id and c.user_id = (select auth.uid())
    )
  );
create policy card_subtasks_delete_own on public.card_subtasks
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.card_subtasks to authenticated;
-- The embeddings cron drain reads card text with service_role.
grant select on public.card_subtasks to service_role;

-- Touch the parent card, so the palette's recency order and the embedding
-- backlog follow subtask changes (same reasoning as card_labels, #577). A
-- moved subtask touches both its old and its new card.
create function private.touch_card_from_subtask()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cards
  set updated_at = pg_catalog.now()
  where id in (
      case when tg_op = 'INSERT' then null else old.card_id end,
      case when tg_op = 'DELETE' then null else new.card_id end
    )
    and updated_at < pg_catalog.now();
  return null;
end;
$$;

create trigger card_subtasks_touch_card
  after insert or update or delete on public.card_subtasks
  for each row execute function private.touch_card_from_subtask();

revoke execute on function private.touch_card_from_subtask()
  from public, anon, authenticated;

-- "Make it a card" (ADR-0053 §3): the subtask becomes a card at the end of the
-- parent's column. security invoker like move_card (ADR-0015): RLS governs
-- every statement, the guard only fixes the error shape. MV404 = subtask not
-- found or not the caller's.
create function public.promote_card_subtask(p_subtask_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_title text;
  v_column_id uuid;
  v_position numeric;
  v_card_id uuid;
begin
  select s.user_id, s.title, c.column_id
  into v_owner, v_title, v_column_id
  from public.card_subtasks s
  join public.cards c on c.id = s.card_id
  where s.id = p_subtask_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'subtask % not found or not owned by the caller', p_subtask_id
      using errcode = 'MV404';
  end if;

  select coalesce(max(position) + 1000, 1000) into v_position
  from public.cards
  where column_id = v_column_id and user_id = (select auth.uid());

  insert into public.cards (user_id, column_id, title, position)
  values ((select auth.uid()), v_column_id, pg_catalog.btrim(v_title), v_position)
  returning id into v_card_id;

  delete from public.card_subtasks
  where id = p_subtask_id and user_id = (select auth.uid());

  return v_card_id;
end;
$$;

comment on function public.promote_card_subtask is
  'Turns a subtask into a card at the end of its parent card''s column and deletes the subtask (ADR-0053). security invoker.';

revoke execute on function public.promote_card_subtask(uuid) from public, anon;
grant execute on function public.promote_card_subtask(uuid) to authenticated;

-- Keyword search (ADR-0053): a query matching a subtask title returns the
-- parent card. One row per card, scored by its best matching field, so a card
-- whose title and subtask both match is listed once. Only the card branch
-- differs from 20261023000004; grants survive create or replace.
create or replace function public.search_text(
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
             0.8 * extensions.word_similarity(v_q, coalesce(c.description, '')),
             0.8 * coalesce(st.score, 0)
           )::double precision
    from public.cards c
    left join lateral (
      select max(extensions.word_similarity(v_q, s.title)) as score
      from public.card_subtasks s
      where s.card_id = c.id and s.title ilike v_pattern
    ) st on true
    where (p_types is null or 'card' = any (p_types))
      and (c.title ilike v_pattern or c.description ilike v_pattern or st.score is not null)
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
