-- Labels get a writer (ADR-0052). Before that, tighten the join table's write
-- policies: a card_labels row may only link the caller's own card to the
-- caller's own label on the same board. Until now only user_id was checked.
-- Also bounds label names. Not applied to hosted by merging: needs the user's
-- explicit go.

create function private.card_label_link_ok(p_card_id uuid, p_label_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards c
    join public.board_columns bc on bc.id = c.column_id
    join public.labels l on l.board_id = bc.board_id
    where c.id = p_card_id
      and l.id = p_label_id
      and c.user_id = (select auth.uid())
      and l.user_id = (select auth.uid())
  );
$$;

comment on function private.card_label_link_ok(uuid, uuid) is
  'True when the caller owns both the card and the label and they share a board (ADR-0052). security invoker: RLS on cards/labels applies too.';

revoke execute on function private.card_label_link_ok(uuid, uuid) from public, anon;
grant execute on function private.card_label_link_ok(uuid, uuid) to authenticated;

drop policy card_labels_insert_own on public.card_labels;
create policy card_labels_insert_own on public.card_labels
  for insert with check (
    user_id = (select auth.uid())
    and private.card_label_link_ok(card_id, label_id)
  );

drop policy card_labels_update_own on public.card_labels;
create policy card_labels_update_own on public.card_labels
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.card_label_link_ok(card_id, label_id)
  );

alter table public.labels
  add constraint labels_name_length check (char_length(btrim(name)) between 1 and 40) not valid;
