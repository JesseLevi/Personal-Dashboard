-- #169: "Perf: drag settelt lokaal" -- public.move_card and public.move_recipe,
-- this repo's second and third RPCs (public.replace_recipe_contents, #149,
-- 20260802000001_recipe_step_ingredients.sql, was the first). Each collapses
-- app/(app)/te-doen/actions.ts's moveCard / app/(app)/recepten/actions.ts's
-- moveRecipe from a four-query chain (auth -> card/recipe lookup -> target
-- column/category lookup -> siblings lookup -> update) into one atomic
-- round trip -- the ticket's stated fix for the drag settling ~2s after drop:
-- with revalidatePath removed from both actions (the client already applies
-- the move optimistically), the four sequential round trips were the
-- remaining latency, not the RSC re-render. See docs/decisions/ for the ADR
-- covering this pattern's relationship to replace_recipe_contents.
--
-- Conventions, matching 20260802000001_recipe_step_ingredients.sql's RPC
-- exactly: `security invoker` (never `security definer` -- RLS on
-- public.cards/board_columns/recipes/recipe_categories still governs every
-- statement inside, same as if the caller had issued them directly) +
-- `set search_path = ''` so every reference below is schema-qualified and
-- cannot be hijacked by a search_path trick. Both functions re-check
-- ownership explicitly in their body rather than trusting RLS alone to
-- surface the right error shape -- they're reachable directly via PostgREST
-- by any authenticated caller, and (for move_card specifically) RLS alone
-- would let a `p_column_id` from a *different* board of the same user
-- through unnoticed, same "don't trust the client for ownership" note
-- app/(app)/te-doen/actions.ts's header comment already carries.
--
-- Error signalling: each ownership/scope guard below raises with a custom
-- 5-character SQLSTATE (Postgres requires exactly five characters; 'MV'
-- prefix keeps them visibly distinct from real Postgres classes and from
-- plpgsql's own default 'P0001') instead of only a message string --
-- app/(app)/te-doen/actions.ts's moveCard and app/(app)/recepten/actions.ts's
-- moveRecipe branch on `error.code` to map each one back onto the same
-- ActionResult error codes ("not-found" / "column-mismatch") the old
-- multi-query implementation returned, so the UI's behavior doesn't change:
--   MV404 -- the card/recipe, or the target column/category, was not found
--           or is not owned by the caller (maps to "not-found").
--   MV409 -- move_card only: the target column belongs to a different board
--           than the card's current one (maps to "column-mismatch"). No
--           move_recipe equivalent exists -- recipe_categories have no
--           parent entity the way board_columns has boards (see
--           app/(app)/recepten/actions.ts's moveRecipe comment), so a
--           category is never on anything but this user's own account and
--           the ownership guard above is already the complete check.
-- Anything else (a plain `raise exception` with no explicit errcode,
-- defaulting to plpgsql's 'P0001') falls back to "generic" in both actions --
-- this is the ported InvalidNeighborOrderError case below, which in the old
-- TypeScript implementation was likewise mapped to "generic".
--
-- Position math: both functions port lib/boards/positioning.ts's
-- nextPosition faithfully, including its error case (stale/inconsistent
-- neighbor positions where before >= after) -- the TypeScript version is
-- kept as-is and stays the tested reference (tests/boards-positioning.test.ts);
-- this SQL port has no independent test suite of its own beyond the RLS
-- ownership assertions in supabase/tests/rls-move-rpcs.sql, since the
-- midpoint arithmetic itself is simple enough to review against its
-- TypeScript twin line-by-line and pgTAP has no equivalent to Vitest's
-- property-style "keeps bisecting" assertion.
--
-- ADR-0012 amendment 2 (2026-08-02): this migration reaches the hosted
-- database only via the confirm-then-apply, `workflow_dispatch`-only deploy
-- workflow -- merging this PR does NOT push it to production by itself. See
-- docs/guides/data-layer.md's ADR-0012 bullet.

-- ============================================================================
-- public.move_card(p_card_id, p_column_id, p_target_index)
-- ============================================================================
-- Mirrors the removed app/(app)/te-doen/actions.ts moveCard chain exactly:
-- resolve the card's own board (via its current column), resolve the target
-- column's board, reject a cross-board move, clamp p_target_index against the
-- target column's other cards, compute the neighbor midpoint, update. Returns
-- the new position (numeric) on success.
create function public.move_card(
  p_card_id uuid,
  p_column_id uuid,
  p_target_index int
) returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_source_board_id uuid;
  v_target_board_id uuid;
  v_sibling_count int;
  v_clamped_index int;
  v_before numeric;
  v_after numeric;
  v_position numeric;
begin
  -- The card must exist, be owned by the caller, and we need the board it
  -- currently lives on (via its current column) to check the target column
  -- against below -- same lookup app/(app)/te-doen/actions.ts's moveCard used
  -- to do with `board_columns!inner(board_id)`.
  select c.user_id, bc.board_id
  into v_owner, v_source_board_id
  from public.cards c
  join public.board_columns bc on bc.id = c.column_id
  where c.id = p_card_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'card % not found or not owned by the caller', p_card_id
      using errcode = 'MV404';
  end if;

  -- The known weak spot the ticket calls out: `p_column_id` is only checked
  -- against RLS (does it belong to *a* board of this user?) by default --
  -- nothing stops it from naming a column on a *different* board of the same
  -- user. Resolve the target column's own board_id explicitly.
  select bc.board_id into v_target_board_id
  from public.board_columns bc
  where bc.id = p_column_id
    and bc.user_id = (select auth.uid());

  if v_target_board_id is null then
    raise exception 'column % not found or not owned by the caller', p_column_id
      using errcode = 'MV404';
  end if;

  if v_target_board_id <> v_source_board_id then
    raise exception 'target column % is not on the same board as card %', p_column_id, p_card_id
      using errcode = 'MV409';
  end if;

  -- Neighbor resolution: same "count, clamp, take the (index-1)th and
  -- index-th sibling by position" approach as the removed TypeScript
  -- siblings-lookup, just without materialising the whole ordered list.
  select count(*) into v_sibling_count
  from public.cards
  where column_id = p_column_id
    and user_id = (select auth.uid())
    and id <> p_card_id;

  v_clamped_index := least(greatest(p_target_index, 0), v_sibling_count);

  if v_clamped_index > 0 then
    select position into v_before
    from public.cards
    where column_id = p_column_id
      and user_id = (select auth.uid())
      and id <> p_card_id
    order by position asc
    offset (v_clamped_index - 1) limit 1;
  end if;

  if v_clamped_index < v_sibling_count then
    select position into v_after
    from public.cards
    where column_id = p_column_id
      and user_id = (select auth.uid())
      and id <> p_card_id
    order by position asc
    offset v_clamped_index limit 1;
  end if;

  -- Ported from lib/boards/positioning.ts's nextPosition -- keep the two in
  -- sync; see this migration's header comment on why no shared test covers
  -- this SQL copy directly.
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

  update public.cards
  set column_id = p_column_id, position = v_position
  where id = p_card_id and user_id = (select auth.uid());

  return v_position;
end;
$$;

comment on function public.move_card is
  'Atomic drag-move for a card (#169): resolves ownership, verifies the '
  'target column is on the same board as the card''s current one, computes '
  'the neighbor-midpoint position (ported from lib/boards/positioning.ts''s '
  'nextPosition) and updates -- one round trip in place of the removed '
  'auth -> card lookup -> column lookup -> siblings lookup -> update chain. '
  'security invoker: RLS governs every statement, same as replace_recipe_contents.';

revoke execute on function public.move_card(uuid, uuid, int) from public;
grant execute on function public.move_card(uuid, uuid, int)
  to authenticated, service_role;

-- ============================================================================
-- public.move_recipe(p_recipe_id, p_category_id, p_target_index)
-- ============================================================================
-- Mirrors the removed app/(app)/recepten/actions.ts moveRecipe chain. No
-- column-mismatch equivalent to move_card's MV409 case: recipe_categories
-- have no parent entity the way board_columns has boards, so verifying the
-- target category's own ownership below is already the complete guarantee
-- (see this migration's header comment).
create function public.move_recipe(
  p_recipe_id uuid,
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
  from public.recipes
  where id = p_recipe_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'recipe % not found or not owned by the caller', p_recipe_id
      using errcode = 'MV404';
  end if;

  select user_id into v_category_owner
  from public.recipe_categories
  where id = p_category_id;

  if v_category_owner is null or v_category_owner <> (select auth.uid()) then
    raise exception 'category % not found or not owned by the caller', p_category_id
      using errcode = 'MV404';
  end if;

  select count(*) into v_sibling_count
  from public.recipes
  where category_id = p_category_id
    and user_id = (select auth.uid())
    and id <> p_recipe_id;

  v_clamped_index := least(greatest(p_target_index, 0), v_sibling_count);

  if v_clamped_index > 0 then
    select position into v_before
    from public.recipes
    where category_id = p_category_id
      and user_id = (select auth.uid())
      and id <> p_recipe_id
    order by position asc
    offset (v_clamped_index - 1) limit 1;
  end if;

  if v_clamped_index < v_sibling_count then
    select position into v_after
    from public.recipes
    where category_id = p_category_id
      and user_id = (select auth.uid())
      and id <> p_recipe_id
    order by position asc
    offset v_clamped_index limit 1;
  end if;

  -- Ported from lib/boards/positioning.ts's nextPosition, same as move_card
  -- above.
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

  update public.recipes
  set category_id = p_category_id, position = v_position
  where id = p_recipe_id and user_id = (select auth.uid());

  return v_position;
end;
$$;

comment on function public.move_recipe is
  'Atomic drag-move for a recipe (#169): resolves ownership of both the '
  'recipe and the target category, computes the neighbor-midpoint position '
  '(ported from lib/boards/positioning.ts''s nextPosition) and updates -- '
  'one round trip in place of the removed auth -> recipe lookup -> category '
  'lookup -> siblings lookup -> update chain. security invoker, same as '
  'move_card / replace_recipe_contents.';

revoke execute on function public.move_recipe(uuid, uuid, int) from public;
grant execute on function public.move_recipe(uuid, uuid, int)
  to authenticated, service_role;
