-- Phase 3 (#91): Kanban schema — boards, board_columns, cards, labels, card_labels.
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009.
--
-- Three deliberate deviations from Architecture §4.2, approved by the user
-- (2026-07-23, see issue #91) but not yet folded back into Architecture.md /
-- an ADR — that write-up is Fable's job, not Claude Code's:
--   1. cards.size (s|m|l|xl, nullable) — not in §4.2 at all, added for the
--      detail panel's "Grootte" field and the sort menu.
--   2. cards.priority is `low|medium|urgent` (three values), not §4.2's
--      `urgent|medium|mid|low` — `mid` is dropped, `medium` takes its color.
--   3. boards.is_favorite (§4.2 lists no such column) — modeled as a real
--      "at most one favorite per user" constraint, not a bare boolean.

-- ============================================================================
-- boards
-- ============================================================================

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Fractional positioning: reordering writes one row (new value = midpoint
  -- of its new neighbors) instead of renumbering the whole list. Seed values
  -- are spaced 1000 apart to leave headroom before precision ever matters —
  -- see the board_columns comment below for the full rationale, shared by
  -- boards/board_columns/cards.
  position numeric not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boards is
  'One row per Kanban board (a full board per project, not a column). '
  'is_favorite: the board that loads first on app open — enforced as "at '
  'most one true per user" by boards_one_favorite_per_user below; the '
  'default-board seed trigger guarantees every user starts with exactly '
  'one, but nothing here re-assigns a favorite if that row is later '
  'deleted — that''s for the board-delete ticket to handle.';

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

-- "Precies één favoriet per gebruiker": a partial unique index on user_id
-- restricted to is_favorite = true rows means at most one row per user can
-- have is_favorite = true. Combined with the seed trigger (always creates
-- the default board as the favorite) and the app layer always flipping the
-- old favorite off in the same transaction it flips the new one on, that
-- gives "exactly one" in steady state without a cross-row trigger.
create unique index boards_one_favorite_per_user
  on public.boards (user_id)
  where (is_favorite);

create index boards_user_id_idx on public.boards (user_id);

alter table public.boards enable row level security;

create policy boards_select_own on public.boards
  for select using (user_id = (select auth.uid()));
create policy boards_insert_own on public.boards
  for insert with check (user_id = (select auth.uid()));
create policy boards_update_own on public.boards
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy boards_delete_own on public.boards
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.boards to authenticated;
grant select on public.boards to anon;

-- ============================================================================
-- board_columns
-- ============================================================================

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  -- Must be a value of the IconName union in components/atoms/Icon.tsx —
  -- PascalCase (e.g. 'AlarmClockCheck'), NOT the hyphenated Figma layer name
  -- ('Alarm-clock-check'). Icon.tsx looks the value up directly in its ICONS
  -- record, so the hyphenated form resolves to undefined and renders nothing.
  -- No UI to choose this yet: the four seeded columns own the only icons in
  -- use until custom columns ship (issue #91 / Figma annotation on the Status
  -- field, node 3779:4853).
  icon text not null,
  -- Same fractional-positioning scheme as boards.position: numeric, unbounded
  -- precision, new value = midpoint of its neighbors on reorder. Chosen over
  -- an explicit rewrite-in-transaction because the drag & drop ticket (which
  -- depends on this one) reorders one row at a time and reordering must not
  -- turn into an O(n) rewrite of every sibling row on every drop. Postgres
  -- `numeric` has no fixed decimal-digit ceiling, so repeated bisection
  -- between the same two neighbors would take an astronomical number of
  -- drops before precision became a practical concern — and the mitigation
  -- (an occasional re-spacing pass) is a data-layer maintenance job, not a
  -- schema concern.
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.board_columns is
  'Columns within a board. The four default columns (Ideeën/Klaar/Bezig/'
  'Afgerond) are fixed for this phase — see the seed trigger below and '
  'issue #91; renaming/adding columns is explicit future work.';

create trigger board_columns_set_updated_at
  before update on public.board_columns
  for each row execute function public.set_updated_at();

create index board_columns_user_id_idx on public.board_columns (user_id);
create index board_columns_board_id_idx on public.board_columns (board_id);

alter table public.board_columns enable row level security;

create policy board_columns_select_own on public.board_columns
  for select using (user_id = (select auth.uid()));
create policy board_columns_insert_own on public.board_columns
  for insert with check (user_id = (select auth.uid()));
create policy board_columns_update_own on public.board_columns
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy board_columns_delete_own on public.board_columns
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.board_columns to authenticated;
grant select on public.board_columns to anon;

-- ============================================================================
-- cards
-- ============================================================================

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  column_id uuid not null references public.board_columns (id) on delete cascade,
  title text not null,
  description text,
  -- Deviation from Architecture §4.2 (`urgent|medium|mid|low`): the Figma
  -- dropdown annotation (node 3779:4856) only lists Low/Medium/Urgent; `mid`
  -- is dropped and `medium` takes over its color. See issue #91.
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'urgent')),
  -- Not in Architecture §4.2 at all: the detail panel's "Grootte" field
  -- (desktop node 3779:4939, mobile 3779:4847) and the sort menu's "Grootte"
  -- option. Nullable — a card need not have a size.
  size text
    check (size is null or size in ('s', 'm', 'l', 'xl')),
  due_at timestamptz,
  -- Same fractional-positioning scheme as board_columns.position.
  position numeric not null,
  -- ADR-0005: 'manual' now, 'mail' reserved for the future Mail-integratie.
  source text not null default 'manual'
    check (source in ('manual', 'mail')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create index cards_user_id_idx on public.cards (user_id);
create index cards_column_id_idx on public.cards (column_id);

alter table public.cards enable row level security;

create policy cards_select_own on public.cards
  for select using (user_id = (select auth.uid()));
create policy cards_insert_own on public.cards
  for insert with check (user_id = (select auth.uid()));
create policy cards_update_own on public.cards
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cards_delete_own on public.cards
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.cards to authenticated;
grant select on public.cards to anon;

-- ============================================================================
-- labels
-- ============================================================================

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.labels is 'Board-scoped labels (Architecture §4.2).';

create trigger labels_set_updated_at
  before update on public.labels
  for each row execute function public.set_updated_at();

create index labels_user_id_idx on public.labels (user_id);
create index labels_board_id_idx on public.labels (board_id);

alter table public.labels enable row level security;

create policy labels_select_own on public.labels
  for select using (user_id = (select auth.uid()));
create policy labels_insert_own on public.labels
  for insert with check (user_id = (select auth.uid()));
create policy labels_update_own on public.labels
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy labels_delete_own on public.labels
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.labels to authenticated;
grant select on public.labels to anon;

-- ============================================================================
-- card_labels
-- ============================================================================

create table public.card_labels (
  id uuid primary key default gen_random_uuid(),
  -- ADR-0001 has no join-table exception: card_labels gets its own user_id
  -- even though it is reachable via cards.user_id / labels.user_id too.
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, label_id)
);

comment on table public.card_labels is
  'Card <-> label join table. Carries its own user_id per ADR-0001 (no '
  'exceptions, not even for join tables).';

create trigger card_labels_set_updated_at
  before update on public.card_labels
  for each row execute function public.set_updated_at();

create index card_labels_user_id_idx on public.card_labels (user_id);
create index card_labels_card_id_idx on public.card_labels (card_id);
create index card_labels_label_id_idx on public.card_labels (label_id);

alter table public.card_labels enable row level security;

create policy card_labels_select_own on public.card_labels
  for select using (user_id = (select auth.uid()));
create policy card_labels_insert_own on public.card_labels
  for insert with check (user_id = (select auth.uid()));
create policy card_labels_update_own on public.card_labels
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy card_labels_delete_own on public.card_labels
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.card_labels to authenticated;
grant select on public.card_labels to anon;

-- ============================================================================
-- Seed: every new user gets a working default board.
-- ============================================================================
-- Trigger-based (same approach as handle_new_user() in
-- 20260720000001_profiles.sql), in a function of its own rather than folded
-- into handle_new_user():
--   - keeps "create the profile row" and "seed starter Kanban content"
--     independently readable/removable instead of growing one function into
--     two unrelated concerns;
--   - both fire off the same auth.users insert, and board seeding has no
--     dependency on the profile row existing first, so trigger-fire order
--     between them doesn't matter;
--   - a trigger (vs. seeding lazily from the data layer on first Kanban
--     page load) means every auth.users row gets a board unconditionally —
--     including rows inserted directly by the RLS test fixtures — with no
--     "board doesn't exist yet" race the first time a new user opens
--     /kanban.
create function public.seed_default_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
begin
  insert into public.boards (user_id, name, position, is_favorite)
  values (new.id, 'Te doen', 1000, true)
  returning id into new_board_id;

  insert into public.board_columns (user_id, board_id, name, icon, position)
  values
    (new.id, new_board_id, 'Ideeën', 'Lightbulb', 1000),
    (new.id, new_board_id, 'Klaar', 'AlarmClockCheck', 2000),
    (new.id, new_board_id, 'Bezig', 'Loader', 3000),
    (new.id, new_board_id, 'Afgerond', 'CircleCheck', 4000);

  return new;
end;
$$;

create trigger on_auth_user_created_seed_board
  after insert on auth.users
  for each row execute function public.seed_default_board();
