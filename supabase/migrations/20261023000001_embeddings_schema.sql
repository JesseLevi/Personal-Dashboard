-- #577 (epic #31, ADR-0043): pgvector, AI opt-in on profiles, public.embeddings
-- and set_ai_enabled(). All additive.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create extension if not exists vector with schema extensions;

-- ============================================================================
-- Opt-in per member (ADR-0043 §2)
-- ============================================================================

alter table public.profiles
  add column ai_enabled boolean not null default false,
  add column ai_enabled_at timestamptz;

comment on column public.profiles.ai_enabled is
  'Opt-in for sending content to the embedding provider (ADR-0043). Written only through set_ai_enabled().';
comment on column public.profiles.ai_enabled_at is
  'When ai_enabled was last switched on; null while off. Written only through set_ai_enabled().';

-- Column grants make set_ai_enabled() the only writer of the two new columns.
-- Future profile columns need their own grant.
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, last_name, locale, avatar_path) on public.profiles to authenticated;
grant update (display_name, last_name, locale, avatar_path) on public.profiles to authenticated;

-- ============================================================================
-- embeddings (exclusive arc, one row per chunk)
-- ============================================================================

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  calendar_event_id uuid references public.calendar_events (id) on delete cascade,
  shopping_list_item_id uuid references public.shopping_list_items (id) on delete cascade,
  chunk_index integer not null default 0 check (chunk_index >= 0),
  content_text text not null,
  content_hash text not null,
  source_updated_at timestamptz not null,
  model text not null,
  embedding extensions.halfvec(1024) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(note_id, recipe_id, card_id, calendar_event_id, shopping_list_item_id) = 1),
  unique (note_id, chunk_index),
  unique (recipe_id, chunk_index),
  unique (card_id, chunk_index),
  unique (calendar_event_id, chunk_index),
  unique (shopping_list_item_id, chunk_index)
);

comment on table public.embeddings is
  'Semantic index of notes, recipes, cards, events and basket items (ADR-0043). user_id is the source owner, whose ai_enabled governs. No ANN index on purpose (ADR-0043 §9).';

create trigger embeddings_set_updated_at
  before update on public.embeddings
  for each row execute function public.set_updated_at();

create index embeddings_user_id_idx on public.embeddings (user_id);
create index embeddings_user_hash_model_idx on public.embeddings (user_id, content_hash, model);

alter table public.embeddings enable row level security;

-- Owner only. Writes also need consent and a source the caller owns, so a
-- foreign source id cannot be attached to your own user_id.
create policy embeddings_select_own on public.embeddings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy embeddings_insert_own on public.embeddings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ai_enabled)
    and (
      exists (select 1 from public.notes s where s.id = embeddings.note_id and s.user_id = embeddings.user_id)
      or exists (select 1 from public.recipes s where s.id = embeddings.recipe_id and s.user_id = embeddings.user_id)
      or exists (select 1 from public.cards s where s.id = embeddings.card_id and s.user_id = embeddings.user_id)
      or exists (select 1 from public.calendar_events s where s.id = embeddings.calendar_event_id and s.user_id = embeddings.user_id)
      or exists (select 1 from public.shopping_list_items s where s.id = embeddings.shopping_list_item_id and s.user_id = embeddings.user_id)
    )
  );

create policy embeddings_update_own on public.embeddings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ai_enabled)
  );

create policy embeddings_delete_own on public.embeddings
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.embeddings to authenticated;
grant select on public.embeddings to anon;
grant select, insert, update, delete on public.embeddings to service_role;

-- ============================================================================
-- set_ai_enabled
-- ============================================================================

-- security definer, not invoker: the ai_* columns have no client column grant
-- (above), so an invoker function could not write them. The body only touches
-- the caller's own rows (auth.uid()), and search_path is empty.
create function public.set_ai_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'p_enabled must not be null' using errcode = '22004';
  end if;

  update public.profiles
  set ai_enabled = p_enabled,
      ai_enabled_at = case
        when not p_enabled then null
        when ai_enabled then ai_enabled_at
        else pg_catalog.now()
      end
  where id = v_uid;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if not p_enabled then
    delete from public.embeddings where user_id = v_uid;
  end if;
end;
$$;

comment on function public.set_ai_enabled is
  'Switches the caller''s AI opt-in. Turning it off deletes all of their embeddings in the same transaction (ADR-0043 §2).';

revoke execute on function public.set_ai_enabled(boolean) from public, anon;
grant execute on function public.set_ai_enabled(boolean) to authenticated, service_role;
