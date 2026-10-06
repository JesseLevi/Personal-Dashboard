-- #286: public.toggle_board_favorite -- atomic replacement for the two
-- sequential statements (clear old favorite, set new) that
-- app/(app)/te-doen/actions.ts's toggleBoardFavorite used to issue. A failure
-- between them could leave a user with zero favorites. Now one function body
-- = one transaction: either the whole toggle lands or none of it does.
--
-- Conventions follow ADR-0015 / 20260810000002_move_rpcs.sql exactly:
-- `security invoker` (RLS on public.boards still governs every statement) +
-- `set search_path = ''` (everything schema-qualified) + revoke from public,
-- grant to authenticated/service_role. Ownership is also checked explicitly
-- (user_id = auth.uid()) as in move_card.
--
-- boards_one_favorite_per_user (partial unique index on is_favorite, see
-- 20260723000001_kanban_schema.sql) is not deferrable, so the old favorite is
-- cleared BEFORE the new one is set, inside this one transaction.
--
-- Error signalling: MV404 (same SQLSTATE as move_card) = board not found or
-- not owned by the caller; the action maps it to "not-found".
--
-- Returns the board's new is_favorite value.
--
-- Reaches the hosted database only via deploy.yml (workflow_dispatch) or a
-- user-confirmed apply (ADR-0012, 2026-08-02 amendments) -- merging does not
-- push it by itself.
create function public.toggle_board_favorite(p_board_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current boolean;
  v_next boolean;
begin
  -- `for update` serialises concurrent toggles of the same board.
  select is_favorite into v_current
  from public.boards
  where id = p_board_id
    and user_id = (select auth.uid())
  for update;

  if v_current is null then
    raise exception 'board % not found or not owned by the caller', p_board_id
      using errcode = 'MV404';
  end if;

  v_next := not v_current;

  if v_next then
    update public.boards
    set is_favorite = false
    where user_id = (select auth.uid())
      and is_favorite;
  end if;

  update public.boards
  set is_favorite = v_next
  where id = p_board_id
    and user_id = (select auth.uid());

  return v_next;
end;
$$;

comment on function public.toggle_board_favorite is
  'Atomic favorite toggle for a board (#286): on = clears the user''s '
  'previous favorite and sets this one, off = clears this one; one '
  'transaction, so never zero-by-failure or two favorites. security invoker: '
  'RLS governs every statement, same as move_card (ADR-0015).';

revoke execute on function public.toggle_board_favorite(uuid) from public;
grant execute on function public.toggle_board_favorite(uuid)
  to authenticated, service_role;
