-- #228: public.move_note(p_note_id, p_category_id, p_target_index) --
-- drag & drop persistence for the notes overview, following ADR-0015
-- (public.move_card / public.move_recipe, 20260810000002_move_rpcs.sql)
-- exactly rather than a plain multi-statement Server Action.
--
-- Why the RPC form, not a plain action (the ticket's explicit "decide and
-- motivate" ask): moving a note between categories is the same
-- category-switch-plus-reposition shape ADR-0015 names as its reason for
-- move_card/move_recipe -- a drop can change `notes.category_id` AND
-- recompute `notes.position` against the new category's sibling list in one
-- motion, and that must be atomic. A plain action doing
-- "auth -> note lookup -> target-category lookup -> siblings lookup ->
-- update" as four sequential statements reopens exactly the partial-failure
-- window ADR-0015 closed for cards/recipes (a crash between the siblings
-- lookup and the update could theoretically land a note with a stale
-- position relative to a sibling insert that raced it) and reintroduces the
-- same four-round-trip latency #169 removed for the other two boards. There
-- is no reason specific to notes to accept either regression, so this
-- migration ports the same pattern rather than inventing a second one.
--
-- Conventions, matching move_card/move_recipe exactly: `security invoker`
-- (never `security definer` -- RLS on public.notes/note_categories still
-- governs every statement inside, same as if the caller had issued them
-- directly) + `set search_path = ''` so every reference below is
-- schema-qualified and cannot be hijacked by a search_path trick. Re-checks
-- ownership explicitly in the function body rather than trusting RLS alone
-- to surface the right error shape -- reachable directly via PostgREST by
-- any authenticated caller, same "don't trust the client for ownership"
-- reasoning as move_card/move_recipe.
--
-- No MV409 (column/board-mismatch) case exists here, same as move_recipe:
-- note_categories, like recipe_categories, have no parent entity the way
-- board_columns have boards -- a category is never on anything but this
-- user's own account, so the ownership guard on both the note and the
-- target category below is already the complete check. Only MV404
-- (not-found/not-owned, on either the note or the target category) is
-- raised.
--
-- Position math: ports lib/boards/positioning.ts's nextPosition faithfully,
-- including its error case (stale/inconsistent neighbor positions where
-- before >= after) -- same as move_card/move_recipe, reviewed against the
-- TypeScript reference (tests/boards-positioning.test.ts) rather than tested
-- independently in pgTAP (no property-style bisection assertion exists in
-- that harness, per 20260810000002_move_rpcs.sql's own header comment).
--
-- ADR-0012 amendment 2 (2026-08-02): this migration reaches the hosted
-- database only via the confirm-then-apply, `workflow_dispatch`-only deploy
-- workflow -- merging this PR does NOT push it to production by itself. See
-- docs/guides/data-layer.md's ADR-0012 bullet.

create function public.move_note(
  p_note_id uuid,
  p_category_id uuid,
  p_target_index int
) returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_category_owner uuid;
  v_sibling_count int;
  v_clamped_index int;
  v_before numeric;
  v_after numeric;
  v_position numeric;
begin
  select user_id into v_owner
  from public.notes
  where id = p_note_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'note % not found or not owned by the caller', p_note_id
      using errcode = 'MV404';
  end if;

  select user_id into v_category_owner
  from public.note_categories
  where id = p_category_id;

  if v_category_owner is null or v_category_owner <> (select auth.uid()) then
    raise exception 'category % not found or not owned by the caller', p_category_id
      using errcode = 'MV404';
  end if;

  select count(*) into v_sibling_count
  from public.notes
  where category_id = p_category_id
    and user_id = (select auth.uid())
    and id <> p_note_id;

  v_clamped_index := least(greatest(p_target_index, 0), v_sibling_count);

  if v_clamped_index > 0 then
    select position into v_before
    from public.notes
    where category_id = p_category_id
      and user_id = (select auth.uid())
      and id <> p_note_id
    order by position asc
    offset (v_clamped_index - 1) limit 1;
  end if;

  if v_clamped_index < v_sibling_count then
    select position into v_after
    from public.notes
    where category_id = p_category_id
      and user_id = (select auth.uid())
      and id <> p_note_id
    order by position asc
    offset v_clamped_index limit 1;
  end if;

  -- Ported from lib/boards/positioning.ts's nextPosition, same as
  -- move_card/move_recipe above.
  if v_before is not null and v_after is not null then
    if v_before >= v_after then
      raise exception 'before-position must be less than after-position';
    end if;
    v_position := (v_before + v_after) / 2;
  elsif v_before is not null then
    v_position := v_before + 1000;
  elsif v_after is not null then
    v_position := v_after / 2;
  else
    v_position := 1000;
  end if;

  update public.notes
  set category_id = p_category_id, position = v_position
  where id = p_note_id and user_id = (select auth.uid());

  return v_position;
end;
$$;

comment on function public.move_note is
  'Atomic drag-move for a note (#228): resolves ownership of both the note '
  'and the target category, computes the neighbor-midpoint position '
  '(ported from lib/boards/positioning.ts''s nextPosition) and updates -- '
  'one round trip covering the category-switch-plus-reposition that a '
  'plain multi-statement action could only do as an unsafe four-query '
  'chain (see this migration''s file-header note). security invoker, same '
  'as move_card / move_recipe / replace_recipe_contents.';

revoke execute on function public.move_note(uuid, uuid, int) from public;
grant execute on function public.move_note(uuid, uuid, int)
  to authenticated, service_role;
