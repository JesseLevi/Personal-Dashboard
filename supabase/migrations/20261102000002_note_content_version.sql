-- Optimistic concurrency for note saves (ADR-0056).
--   notes.content_version                  bumped by every content save, never by move/rename
--   public.save_note_content_versioned     saves only when the caller's version is current
--   public.save_note_content (unchanged signature) also bumps the version, so a
--   client still on the old write path invalidates a stale versioned client.
--
-- Additive only (ADR-0032 §5): production code that predates this migration
-- keeps calling the 5-argument function. Not applied to hosted by merging:
-- needs the user's explicit go.

alter table public.notes
  add column content_version integer not null default 0;

comment on column public.notes.content_version is
  'Incremented by every save of content (ADR-0056). Not updated_at: moving a note also bumps that.';

create or replace function public.save_note_content(
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
  set content = p_content, title = p_title, content_text = p_content_text,
      content_version = content_version + 1
  where id = p_note_id and user_id = (select auth.uid())
  returning id into v_updated;

  if v_updated is null then
    raise exception 'note % not found or not owned by the caller', p_note_id
      using errcode = 'NL404';
  end if;

  delete from public.note_links
  where source_note_id = p_note_id and user_id = (select auth.uid());

  insert into public.note_links (user_id, source_note_id, target_note_id)
  select (select auth.uid()), p_note_id, n.id
  from public.notes n
  where n.id = any (coalesce(p_target_ids, '{}'::uuid[]))
    and n.user_id = (select auth.uid())
    and n.id <> p_note_id;
end;
$$;

create function public.save_note_content_versioned(
  p_note_id uuid,
  p_content jsonb,
  p_title text,
  p_content_text text,
  p_target_ids uuid[],
  p_expected_version integer
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
begin
  update public.notes
  set content = p_content, title = p_title, content_text = p_content_text,
      content_version = content_version + 1
  where id = p_note_id
    and user_id = (select auth.uid())
    and content_version = p_expected_version
  returning content_version into v_version;

  if v_version is null then
    if exists (
      select 1 from public.notes
      where id = p_note_id and user_id = (select auth.uid())
    ) then
      raise exception 'note % changed since version %', p_note_id, p_expected_version
        using errcode = 'NL409';
    end if;
    raise exception 'note % not found or not owned by the caller', p_note_id
      using errcode = 'NL404';
  end if;

  delete from public.note_links
  where source_note_id = p_note_id and user_id = (select auth.uid());

  insert into public.note_links (user_id, source_note_id, target_note_id)
  select (select auth.uid()), p_note_id, n.id
  from public.notes n
  where n.id = any (coalesce(p_target_ids, '{}'::uuid[]))
    and n.user_id = (select auth.uid())
    and n.id <> p_note_id;

  return v_version;
end;
$$;

comment on function public.save_note_content_versioned is
  'Note save with a version check (ADR-0056): as save_note_content, but only '
  'when content_version equals p_expected_version; returns the new version. '
  'NL409 = changed elsewhere, NL404 = not found or not owned. security invoker.';

revoke execute on function public.save_note_content_versioned(uuid, jsonb, text, text, uuid[], integer) from public;
grant execute on function public.save_note_content_versioned(uuid, jsonb, text, text, uuid[], integer)
  to authenticated, service_role;
