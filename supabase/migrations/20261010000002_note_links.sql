-- #340 (ADR-0023): note_links + public.save_note_content.
--
-- note_links is derived data: the set of notes a document links to, rebuilt
-- from notes.content on every save by save_note_content below and never
-- written by the UI directly. It exists so "which notes link to X" is an
-- index lookup on target_note_id rather than a scan of every document's
-- jsonb (ADR-0023, alternatives considered).
--
-- Additive only: existing notes keep loading unchanged and simply have no
-- links until their next save.
--
-- RLS: a link row is only visible/writable to its owner, and an insert must
-- point from one of the caller's own notes to another of the caller's own
-- notes, so even a direct PostgREST insert cannot attach a link to someone
-- else's note. Cascade FKs on both ends remove links when either note goes.
--
-- save_note_content follows the ADR-0015 RPC pattern (move_note,
-- 20260813000002_move_note_rpc.sql): security invoker, search_path = '',
-- revoke from public, execute for authenticated/service_role only. Unknown or
-- foreign target ids (and a self-link) are dropped silently, not errored: the
-- insert selects from public.notes under the caller's RLS, so they never match.
--
-- Hosted rollout only via the confirm-then-apply deploy workflow (ADR-0012).

create table public.note_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  source_note_id uuid not null references public.notes (id) on delete cascade,
  target_note_id uuid not null references public.notes (id) on delete cascade,
  primary key (source_note_id, target_note_id)
);

comment on table public.note_links is
  'Derived link graph between notes (ADR-0023): one row per distinct '
  '(source, target) pair found in the source note''s TipTap document. '
  'Rebuilt by save_note_content on every save; never written by the UI.';

-- Backlinks: "which notes link to X".
create index note_links_target_note_id_idx on public.note_links (target_note_id);
create index note_links_user_id_idx on public.note_links (user_id);

alter table public.note_links enable row level security;

create policy note_links_select_own on public.note_links
  for select using (user_id = (select auth.uid()));
create policy note_links_insert_own on public.note_links
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notes n
      where n.id = source_note_id and n.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.notes n
      where n.id = target_note_id and n.user_id = (select auth.uid())
    )
  );
create policy note_links_delete_own on public.note_links
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.note_links to authenticated;
grant select on public.note_links to anon;
grant select, insert, update, delete on public.note_links to service_role;

create function public.save_note_content(
  p_note_id uuid,
  p_content jsonb,
  p_title text,
  p_content_text text,
  p_target_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  update public.notes
  set content = p_content, title = p_title, content_text = p_content_text
  where id = p_note_id and user_id = (select auth.uid())
  returning id into v_updated;

  if v_updated is null then
    raise exception 'note % not found or not owned by the caller', p_note_id
      using errcode = 'NL404';
  end if;

  delete from public.note_links
  where source_note_id = p_note_id and user_id = (select auth.uid());

  -- Foreign / unknown / self targets never match the join and are dropped.
  insert into public.note_links (user_id, source_note_id, target_note_id)
  select (select auth.uid()), p_note_id, n.id
  from public.notes n
  where n.id = any (coalesce(p_target_ids, '{}'::uuid[]))
    and n.user_id = (select auth.uid())
    and n.id <> p_note_id;
end;
$$;

comment on function public.save_note_content is
  'Atomic note save (#340, ADR-0023): writes content/title/content_text and '
  'replaces the note''s note_links set in one transaction. security invoker; '
  'target ids the caller does not own are dropped, not errored.';

revoke execute on function public.save_note_content(uuid, jsonb, text, text, uuid[]) from public;
grant execute on function public.save_note_content(uuid, jsonb, text, text, uuid[])
  to authenticated, service_role;
