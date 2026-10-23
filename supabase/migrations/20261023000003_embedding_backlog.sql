-- #577 (ADR-0043 §4-5): the embedding backlog scan and the drain throttle.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- One scan for both entry points. security invoker: a member's own call is
-- bound by RLS, and the explicit p_user filter keeps the service_role path to
-- one member. Clients reach it only through the two wrappers below.
create function private.embedding_backlog_scan(p_user uuid, p_model text, p_limit integer)
returns table (source_type text, source_id uuid, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with consenting as (
    select p.id from public.profiles p where p.id = p_user and p.ai_enabled
  ),
  sources as (
    select 'note'::text as source_type, n.id as source_id, n.updated_at
    from public.notes n
    where n.user_id = p_user
      and (pg_catalog.btrim(n.title) <> '' or pg_catalog.btrim(n.content_text) <> ''
           or exists (select 1 from public.embeddings e where e.note_id = n.id))
    union all
    select 'recipe', r.id, r.updated_at from public.recipes r where r.user_id = p_user
    union all
    select 'card', c.id, c.updated_at from public.cards c where c.user_id = p_user
    union all
    select 'calendar_event', ev.id, ev.updated_at from public.calendar_events ev where ev.user_id = p_user
    union all
    select 'shopping_list_item', s.id, s.updated_at from public.shopping_list_items s where s.user_id = p_user
  ),
  embedded as (
    select case
             when e.note_id is not null then 'note'
             when e.recipe_id is not null then 'recipe'
             when e.card_id is not null then 'card'
             when e.calendar_event_id is not null then 'calendar_event'
             else 'shopping_list_item'
           end as source_type,
           coalesce(e.note_id, e.recipe_id, e.card_id, e.calendar_event_id, e.shopping_list_item_id) as source_id,
           pg_catalog.min(e.source_updated_at) as oldest_source_updated_at,
           pg_catalog.bool_and(e.model = p_model) as all_current_model
    from public.embeddings e
    where e.user_id = p_user
    group by 1, 2
  )
  select s.source_type, s.source_id, s.updated_at
  from sources s
  join consenting on true
  left join embedded em on em.source_type = s.source_type and em.source_id = s.source_id
  where s.updated_at <= pg_catalog.now() - interval '2 minutes'
    and (
      em.source_id is null
      or em.oldest_source_updated_at < s.updated_at
      or not em.all_current_model
    )
  order by s.updated_at asc, s.source_id asc
  limit least(greatest(coalesce(p_limit, 50), 1), 500)
$$;

create function public.embedding_backlog(p_model text, p_limit integer)
returns table (source_type text, source_id uuid, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.embedding_backlog_scan((select auth.uid()), p_model, p_limit)
$$;

create function public.embedding_backlog_for(p_user uuid, p_model text, p_limit integer)
returns table (source_type text, source_id uuid, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.embedding_backlog_scan(p_user, p_model, p_limit)
$$;

comment on function public.embedding_backlog is
  'Sources of the caller that still need (re-)embedding: none yet, stale, or another model; rested 2 minutes; oldest first. Empty without ai_enabled (ADR-0043 §4).';
comment on function public.embedding_backlog_for is
  'Same scan for one member, for the cron route. service_role only (ADR-0043 §4).';

-- Callers need EXECUTE on the private scan because the wrappers are invokers;
-- service_role also needs USAGE on the schema (authenticated has it already).
grant usage on schema private to service_role;
revoke execute on function private.embedding_backlog_scan(uuid, text, integer) from public, anon;
grant execute on function private.embedding_backlog_scan(uuid, text, integer) to authenticated, service_role;
revoke execute on function public.embedding_backlog(text, integer) from public, anon;
grant execute on function public.embedding_backlog(text, integer) to authenticated, service_role;
revoke execute on function public.embedding_backlog_for(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.embedding_backlog_for(uuid, text, integer) to service_role;

-- ============================================================================
-- Drain throttle (ADR-0043 §5)
-- ============================================================================

create table private.embedding_drains (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_run_at timestamptz not null default now()
);

comment on table private.embedding_drains is
  'Last lazy embedding drain per member (ADR-0043 §5). Only claim_embedding_drain() touches it.';

alter table private.embedding_drains enable row level security;
revoke all on private.embedding_drains from anon, authenticated;

create function public.claim_embedding_drain()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claimed boolean;
begin
  if v_uid is null then
    return false;
  end if;

  insert into private.embedding_drains as d (user_id, last_run_at)
  values (v_uid, pg_catalog.now())
  on conflict (user_id) do update
    set last_run_at = pg_catalog.now()
    where d.last_run_at < pg_catalog.now() - interval '10 minutes'
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

comment on function public.claim_embedding_drain is
  'Atomically claims the lazy drain slot of the caller: true (and stamps now()) when the last run was over 10 minutes ago, else false.';

revoke execute on function public.claim_embedding_drain() from public, anon;
grant execute on function public.claim_embedding_drain() to authenticated, service_role;
