-- #490 (epic #33, ADR-0037 §5-7, ADR-0039): ICS import.
--   * create_ics_calendar: account + calendar + Vault secret in one definer call
--   * get_calendar_account_secret: the secret URL, scoped to auth.uid()
--   * apply_calendar_sync: upsert, two-miss deletion, failure guards and the
--     basket notice, per account, under an advisory lock
--   * calendar_sync_notices: the dismissable basket notice (ADR-0037 §6)
--
-- Additive only (ADR-0032 §5). Not applied to hosted by merging: needs the
-- user's explicit go.

-- ============================================================================
-- calendar_sync_notices
-- ============================================================================

-- Why a table and not a derived view: when a deleted event takes its meal plan
-- with it, shopping_list_items.meal_plan_id is set to null (ADR-0037 §3), so the
-- link to the affected basket items is gone. The notice keeps their ids.
create table public.calendar_sync_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_account_id uuid not null references public.calendar_accounts (id) on delete cascade,
  event_title text not null,
  item_ids uuid[] not null,
  created_at timestamptz not null default now()
);

comment on table public.calendar_sync_notices is
  'Dismissable notice after a sync deleted an event with a planned meal (ADR-0037 §6): the event title and the ids of the open basket items that came from that meal plan. Written only by apply_calendar_sync; the owner reads and dismisses (deletes) it.';

create index calendar_sync_notices_user_id_idx on public.calendar_sync_notices (user_id);
create index calendar_sync_notices_account_idx on public.calendar_sync_notices (calendar_account_id);

alter table public.calendar_sync_notices enable row level security;

create policy calendar_sync_notices_select_own on public.calendar_sync_notices
  for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_sync_notices_delete_own on public.calendar_sync_notices
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.calendar_sync_notices from anon, authenticated;
grant select, delete on public.calendar_sync_notices to authenticated;
grant select, insert, update, delete on public.calendar_sync_notices to service_role;

-- ============================================================================
-- The Vault secret goes with its account
-- ============================================================================

create function private.calendar_accounts_delete_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.vault_secret_id is not null then
    delete from vault.secrets where id = old.vault_secret_id;
  end if;
  return old;
end;
$$;

create trigger calendar_accounts_delete_secret
  after delete on public.calendar_accounts
  for each row execute function private.calendar_accounts_delete_secret();

-- ============================================================================
-- create_ics_calendar
-- ============================================================================

create function public.create_ics_calendar(p_name text, p_url text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_secret uuid;
  v_account uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_url is null or char_length(p_url) > 2048 or p_url !~ '^https://' then
    raise exception 'invalid url' using errcode = '22023';
  end if;
  if (select count(*) from public.calendar_accounts where user_id = v_uid) >= 10 then
    raise exception 'too many calendar accounts' using errcode = '54000';
  end if;

  v_secret := vault.create_secret(p_url);

  insert into public.calendar_accounts (user_id, provider, display_name, vault_secret_id)
  values (v_uid, 'ics', v_name, v_secret)
  returning id into v_account;

  insert into public.calendars (user_id, name, kind, calendar_account_id, position)
  values (v_uid, v_name, 'ics', v_account, 2000);

  return v_account;
end;
$$;

comment on function public.create_ics_calendar(text, text) is
  'Creates an ICS calendar account, its calendar and the Vault secret that holds the URL (ADR-0002). The URL is never stored in a column and never returned.';

-- ============================================================================
-- get_calendar_account_secret
-- ============================================================================

create function public.get_calendar_account_secret(p_account_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_secret text;
begin
  -- A signed-in caller gets only their own account's secret. Without a user
  -- (service_role, the cron route) any account is readable; anon has no EXECUTE.
  select s.decrypted_secret into v_secret
  from public.calendar_accounts a
  join vault.decrypted_secrets s on s.id = a.vault_secret_id
  where a.id = p_account_id
    and (v_uid is null or a.user_id = v_uid);
  return v_secret;
end;
$$;

comment on function public.get_calendar_account_secret(uuid) is
  'The decrypted secret URL of one calendar account, for server code only (ADR-0039 §4). A signed-in caller can read only their own account.';

-- ============================================================================
-- apply_calendar_sync
-- ============================================================================

create function public.apply_calendar_sync(
  p_account_id uuid,
  p_events jsonb,
  p_window_from timestamptz,
  p_window_to timestamptz,
  p_failure text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user uuid;
  v_calendar uuid;
  v_now timestamptz := now();
  v_ids text[];
  v_new integer;
  v_existing integer;
  v_written integer := 0;
  v_deleted integer := 0;
  v_marked integer := 0;
  v_failure text := p_failure;
  v_gone record;
  v_items uuid[];
begin
  select a.user_id, c.id into v_user, v_calendar
  from public.calendar_accounts a
  join public.calendars c on c.calendar_account_id = a.id
  where a.id = p_account_id;
  -- One answer for "does not exist" and "not yours".
  if v_user is null or (v_uid is not null and v_user <> v_uid) then
    raise exception 'unknown calendar account' using errcode = '42501';
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended('calendar_sync:' || p_account_id::text, 0)) then
    return jsonb_build_object('status', 'skipped');
  end if;

  if v_failure is not null and v_failure !~ '^[a-z_]{1,40}$' then
    v_failure := 'fetch_failed';
  end if;

  if v_failure is null then
    if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) = 0 then
      v_failure := 'empty';
    elsif jsonb_array_length(p_events) > 20000 then
      v_failure := 'too_large';
    end if;
  end if;

  if v_failure is null then
    select coalesce(array_agg(distinct e.external_id), '{}'),
           count(distinct e.external_id) filter (
             where e.starts_at >= p_window_from and e.starts_at < p_window_to)
      into v_ids, v_new
    from jsonb_to_recordset(p_events) as e(external_id text, starts_at timestamptz)
    where e.external_id is not null and e.external_id <> '';

    select count(*) into v_existing
    from public.calendar_events e
    where e.calendar_account_id = p_account_id
      and e.starts_at >= p_window_from and e.starts_at < p_window_to;

    -- A feed that lost more than half of the window is treated as broken.
    if v_existing > 0 and v_new * 2 < v_existing then
      v_failure := 'drop';
    end if;
  end if;

  if v_failure is not null then
    update public.calendar_accounts
    set sync_state = jsonb_build_object(
      'status', 'failed', 'error', v_failure, 'attempted_at', v_now)
    where id = p_account_id;
    return jsonb_build_object('status', 'failed', 'error', v_failure);
  end if;

  -- Upsert on the stable identity; a row is written only when its content
  -- changed or it is coming back from missing. Never delete and re-insert.
  insert into public.calendar_events (
    user_id, calendar_id, title, starts_at, ends_at, all_day, location,
    description, source, calendar_account_id, external_id, content_hash)
  select distinct on (e.external_id)
    v_user, v_calendar,
    left(coalesce(nullif(btrim(e.title), ''), '—'), 200),
    e.starts_at,
    greatest(e.ends_at, e.starts_at),
    coalesce(e.all_day, false),
    left(nullif(btrim(e.location), ''), 200),
    left(nullif(btrim(e.description), ''), 2000),
    'sync', p_account_id, e.external_id, e.content_hash
  from jsonb_to_recordset(p_events) as e(
    external_id text, title text, starts_at timestamptz, ends_at timestamptz,
    all_day boolean, location text, description text, content_hash text)
  where e.external_id is not null and e.external_id <> ''
    and e.starts_at is not null and e.ends_at is not null
  order by e.external_id
  on conflict (calendar_account_id, external_id) do update set
    title = excluded.title,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    all_day = excluded.all_day,
    location = excluded.location,
    description = excluded.description,
    content_hash = excluded.content_hash,
    missing_since = null
  where public.calendar_events.content_hash is distinct from excluded.content_hash
     or public.calendar_events.missing_since is not null;
  get diagnostics v_written = row_count;

  -- Second miss: delete. The basket items of an attached meal plan outlive
  -- the plan (meal_plan_id is set to null), so their ids go into a notice first.
  for v_gone in
    select e.id, e.title
    from public.calendar_events e
    where e.calendar_account_id = p_account_id
      and e.starts_at >= p_window_from and e.starts_at < p_window_to
      and e.missing_since is not null
      and not (e.external_id = any (v_ids))
  loop
    select coalesce(array_agg(i.id), '{}') into v_items
    from public.shopping_list_items i
    join public.meal_plans m on m.id = i.meal_plan_id
    where m.calendar_event_id = v_gone.id and not i.checked;

    if cardinality(v_items) > 0 then
      insert into public.calendar_sync_notices (user_id, calendar_account_id, event_title, item_ids)
      values (v_user, p_account_id, v_gone.title, v_items);
    end if;

    delete from public.calendar_events where id = v_gone.id;
    v_deleted := v_deleted + 1;
  end loop;

  -- First miss: mark.
  update public.calendar_events e
  set missing_since = v_now
  where e.calendar_account_id = p_account_id
    and e.starts_at >= p_window_from and e.starts_at < p_window_to
    and e.missing_since is null
    and not (e.external_id = any (v_ids));
  get diagnostics v_marked = row_count;

  update public.calendar_accounts
  set last_synced_at = v_now,
      sync_state = jsonb_build_object(
        'status', 'ok', 'attempted_at', v_now, 'events', v_new,
        'written', v_written, 'deleted', v_deleted, 'marked', v_marked)
  where id = p_account_id;

  return jsonb_build_object(
    'status', 'ok', 'written', v_written, 'deleted', v_deleted, 'marked', v_marked);
end;
$$;

comment on function public.apply_calendar_sync(uuid, jsonb, timestamptz, timestamptz, text) is
  'Applies one parsed feed to one account in a single transaction (ADR-0037 §5-6, ADR-0039 §2): upsert on (account, external_id), two-miss deletion inside the window, failure guards (fetch failed, empty, drop of more than half), basket notice. A signed-in caller can act only on their own account; service_role on any. One run per account at a time (advisory lock).';

-- ============================================================================
-- Privileges (#304): the secret and the apply path are for server code
-- ============================================================================

revoke execute on function
  private.calendar_accounts_delete_secret(),
  public.create_ics_calendar(text, text),
  public.get_calendar_account_secret(uuid),
  public.apply_calendar_sync(uuid, jsonb, timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.create_ics_calendar(text, text) to authenticated;
grant execute on function public.get_calendar_account_secret(uuid) to authenticated, service_role;
grant execute on function public.apply_calendar_sync(uuid, jsonb, timestamptz, timestamptz, text)
  to authenticated, service_role;
