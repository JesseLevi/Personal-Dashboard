-- #465 (epic #464, ADR-0036): sharing a recipe sends a copy.
--   a. public.shares gains recipe_id (a recipe offer is only ever pending)
--   b. shares_insert_owner gets a recipe branch
--   c. public.pending_recipe_shares(): the invitee's view of their offers
--   d. public.accept_recipe_share(): copies the recipe into the caller's data
--
-- Not applied to hosted by merging: needs the user's explicit go (ADR-0032).

-- ============================================================================
-- shares: recipe_id
-- ============================================================================

alter table public.shares
  add column recipe_id uuid references public.recipes (id) on delete cascade;

-- The exclusive arc now spans two types. The old check is unnamed, so find it
-- by its definition instead of relying on the generated name.
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.shares'::pg_catalog.regclass
    and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid) like '%num_nonnulls%';
  if v_name is not null then
    execute pg_catalog.format('alter table public.shares drop constraint %I', v_name);
  end if;
end;
$$;

alter table public.shares
  add constraint shares_one_resource_check
    check (num_nonnulls(shopping_list_id, recipe_id) = 1),
  -- A recipe share is an offer, never a membership (ADR-0036 point 2).
  add constraint shares_recipe_pending_check
    check (recipe_id is null or status = 'pending'),
  add constraint shares_recipe_id_member_id_key unique (recipe_id, member_id);

create index shares_recipe_id_idx on public.shares (recipe_id);

-- ============================================================================
-- Insert policy: basket branch unchanged, plus the recipe's owner
-- ============================================================================

drop policy shares_insert_owner on public.shares;
create policy shares_insert_owner on public.shares
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and member_id <> (select auth.uid())
    and status = 'pending'
    and role = 'editor'
    and responded_at is null
    and (
      private.shopping_list_role(shopping_list_id) = 'owner'
      or (
        recipe_id is not null
        and exists (
          select 1 from public.recipes r
          where r.id = recipe_id and r.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- pending_recipe_shares: the offers made to the caller
-- ============================================================================
-- The recipes policies are never widened (ADR-0035 points 4 and 5): the
-- invitee sees only these columns, and only for their own pending rows.

create function public.pending_recipe_shares()
returns table (
  share_id uuid,
  recipe_id uuid,
  title text,
  time_minutes integer,
  thumbnail_path text,
  inviter_id uuid,
  inviter_display_name text,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, r.id, r.title, r.time_minutes, r.thumbnail_path,
         p.id, p.display_name, s.created_at
  from public.shares s
  join public.recipes r on r.id = s.recipe_id
  join public.profiles p on p.id = s.user_id
  where s.member_id = (select auth.uid())
    and s.status = 'pending'
  order by s.created_at desc, s.id
$$;

-- ============================================================================
-- accept_recipe_share: copy the recipe into the caller's own data
-- ============================================================================
-- Definer because the invitee cannot read the source under RLS: a deliberate
-- exception to ADR-0015's invoker rule (ADR-0036 point 4), limited by the
-- guard below. The thumbnail bytes are copied by server code afterwards; the
-- copy starts without one.

create function public.accept_recipe_share(p_share_id uuid)
returns table (recipe_id uuid, source_thumbnail_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_share public.shares%rowtype;
  v_src public.recipes%rowtype;
  v_category_id uuid;
  v_position numeric;
  v_new_recipe_id uuid;
  v_ing public.recipe_ingredients%rowtype;
  v_step public.recipe_steps%rowtype;
  v_new_id uuid;
  v_ing_map jsonb := '{}'::jsonb;
  v_lib_map jsonb := '{}'::jsonb;
  v_lib public.ingredients%rowtype;
  v_key text;
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'accept_recipe_share requires an authenticated user'
      using errcode = '42501';
  end if;

  -- The row lock serialises two concurrent accepts: the loser finds no row.
  select * into v_share from public.shares s where s.id = p_share_id for update;

  if not found
     or v_share.member_id <> v_uid
     or v_share.recipe_id is null
     or v_share.status <> 'pending' then
    raise exception 'share % is not a pending recipe share for the caller', p_share_id
      using errcode = '42501';
  end if;

  select * into v_src from public.recipes r where r.id = v_share.recipe_id;

  select c.id into v_category_id
  from public.recipe_categories c
  where c.user_id = v_uid
  order by c.position, c.created_at, c.id
  limit 1;

  if v_category_id is null then
    raise exception 'caller has no recipe category' using errcode = 'P0001';
  end if;

  -- Top of the column, like nextPosition(null, first) in TypeScript.
  select coalesce(pg_catalog.min(r.position) / 2, 1000) into v_position
  from public.recipes r
  where r.user_id = v_uid and r.category_id = v_category_id;

  insert into public.recipes (
    user_id, category_id, title, servings, thumbnail_path, time_minutes,
    position, source_url, import_status
  ) values (
    v_uid, v_category_id, v_src.title, v_src.servings, null, v_src.time_minutes,
    v_position, v_src.source_url, 'done'
  ) returning id into v_new_recipe_id;

  for v_ing in
    select * from public.recipe_ingredients ri
    where ri.recipe_id = v_src.id
    order by ri.position, ri.created_at, ri.id
  loop
    -- Remap ingredient_id to the caller's own library row; the sender's
    -- private rows are never referenced.
    v_target := null;
    if v_ing.ingredient_id is not null then
      v_key := v_ing.ingredient_id::text;
      if v_lib_map ? v_key then
        v_target := (v_lib_map ->> v_key)::uuid;
      else
        select * into v_lib from public.ingredients i
        where i.id = v_ing.ingredient_id and i.user_id = v_src.user_id;
        if found then
          if v_lib.reference_id is not null then
            select i.id into v_target from public.ingredients i
            where i.user_id = v_uid and i.reference_id = v_lib.reference_id
            order by i.created_at, i.id
            limit 1;
          else
            select i.id into v_target from public.ingredients i
            where i.user_id = v_uid and i.reference_id is null
              and pg_catalog.lower(i.name) = pg_catalog.lower(v_lib.name)
            order by i.created_at, i.id
            limit 1;
          end if;
          if v_target is null then
            insert into public.ingredients (user_id, reference_id, name, category)
            values (v_uid, v_lib.reference_id, v_lib.name, v_lib.category)
            returning id into v_target;
          end if;
        end if;
        v_lib_map := v_lib_map || pg_catalog.jsonb_build_object(v_key, v_target);
      end if;
    end if;

    v_new_id := gen_random_uuid();
    v_ing_map := v_ing_map || pg_catalog.jsonb_build_object(v_ing.id::text, v_new_id);

    insert into public.recipe_ingredients (
      id, user_id, recipe_id, ingredient_id, name, quantity, unit, position,
      group_label, needs_review
    ) values (
      v_new_id, v_uid, v_new_recipe_id, v_target, v_ing.name, v_ing.quantity,
      v_ing.unit, v_ing.position, v_ing.group_label, v_ing.needs_review
    );
  end loop;

  for v_step in
    select * from public.recipe_steps rs
    where rs.recipe_id = v_src.id
    order by rs.position, rs.created_at, rs.id
  loop
    v_new_id := gen_random_uuid();

    insert into public.recipe_steps (id, user_id, recipe_id, position, instruction)
    values (v_new_id, v_uid, v_new_recipe_id, v_step.position, v_step.instruction);

    insert into public.recipe_step_ingredients (
      user_id, step_id, recipe_ingredient_id, position
    )
    select v_uid, v_new_id, (v_ing_map ->> si.recipe_ingredient_id::text)::uuid, si.position
    from public.recipe_step_ingredients si
    where si.step_id = v_step.id
      and v_ing_map ? si.recipe_ingredient_id::text;
  end loop;

  delete from public.shares s where s.id = v_share.id;

  return query select v_new_recipe_id, v_src.thumbnail_path;
end;
$$;

comment on function public.accept_recipe_share(uuid) is
  'Accepts a pending recipe share: copies the recipe, its ingredients, steps '
  'and step links into the caller''s first recipe category and deletes the '
  'share (ADR-0036). security definer, guarded by the caller being the '
  'share''s member_id; the thumbnail is copied by server code.';

-- ============================================================================
-- Privileges
-- ============================================================================

revoke execute on function
  public.pending_recipe_shares(),
  public.accept_recipe_share(uuid)
  from public, anon;
grant execute on function
  public.pending_recipe_shares(),
  public.accept_recipe_share(uuid)
  to authenticated;
