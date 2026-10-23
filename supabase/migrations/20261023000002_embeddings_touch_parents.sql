-- #577 (ADR-0043 §3): updated_at must follow the canonical text.
--
-- Measured from the existing code, not assumed:
--   * replace_recipe_contents() only deletes and inserts recipe_ingredients,
--     recipe_steps and recipe_step_ingredients; it never updates the recipes
--     row, so recipes.updated_at stays put when ingredients or steps change.
--   * card_labels has its own updated_at trigger, which never reaches cards,
--     so adding or removing a label leaves cards.updated_at alone.
-- Both would hide edits from the embedding backlog. Touch triggers on the
-- children fix that without editing the RPC. `updated_at < now()` makes
-- the touch cost one update per transaction, however many rows change.
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

create function private.touch_recipe_from_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipes
  set updated_at = pg_catalog.now()
  where id = case when tg_op = 'DELETE' then old.recipe_id else new.recipe_id end
    and updated_at < pg_catalog.now();
  return null;
end;
$$;

create trigger recipe_ingredients_touch_recipe
  after insert or update or delete on public.recipe_ingredients
  for each row execute function private.touch_recipe_from_child();

create trigger recipe_steps_touch_recipe
  after insert or update or delete on public.recipe_steps
  for each row execute function private.touch_recipe_from_child();

create function private.touch_card_from_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cards
  set updated_at = pg_catalog.now()
  where id = case when tg_op = 'DELETE' then old.card_id else new.card_id end
    and updated_at < pg_catalog.now();
  return null;
end;
$$;

create trigger card_labels_touch_card
  after insert or delete on public.card_labels
  for each row execute function private.touch_card_from_label();

-- A label rename changes the text of every card that carries the label.
create function private.touch_cards_from_label_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cards c
  set updated_at = pg_catalog.now()
  where c.id in (select cl.card_id from public.card_labels cl where cl.label_id = new.id)
    and c.updated_at < pg_catalog.now();
  return null;
end;
$$;

create trigger labels_touch_cards
  after update of name on public.labels
  for each row when (old.name is distinct from new.name)
  execute function private.touch_cards_from_label_rename();

revoke execute on function
  private.touch_recipe_from_child(),
  private.touch_card_from_label(),
  private.touch_cards_from_label_rename()
  from public, anon, authenticated;
