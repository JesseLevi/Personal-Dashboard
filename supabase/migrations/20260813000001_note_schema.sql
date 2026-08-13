-- Phase 6 (#225): note schema — note_categories, notes.
-- Conventions per Architecture §4.1 / ADR-0001 / ADR-0009, same house style
-- as 20260720000001_profiles.sql / 20260723000001_kanban_schema.sql /
-- 20260730000002_recipe_schema.sql. This ticket is schema-only because it is
-- wave 1 of Phase 6 (Notities) -- the overview/editor pages are later
-- tickets in the same phase (#228+), not because the phase itself has no UI.
--
-- Engineering calls made in this migration, and why:
--
--   - notes.category_id is `not null ... on delete cascade`, same choice as
--     recipes.category_id -> recipe_categories (20260730000002_recipe_schema.sql):
--     a note belongs to exactly one category, and note_categories is this
--     module's own "kanban columns" (same shape as recipe_categories per the
--     ticket). Deleting a category removes its notes, mirroring
--     board_columns -> cards and recipe_categories -> recipes exactly. The
--     ticket explicitly asked to follow the recipes precedent absent a good
--     reason not to -- there isn't one here.
--
--   - notes.title is `text not null` with NO default-derivation trigger and
--     NO check forbidding the empty string. User decision 2026-08-13 (issue
--     #225): the title is the first line of the TipTap document, but the
--     Figma editor node (4067:20020) has no separate title field, so nothing
--     server-side should try to keep title in sync by parsing content jsonb
--     in a trigger -- that would mean a Postgres trigger re-implementing
--     TipTap-document-to-plain-text extraction, duplicating logic the app
--     layer needs anyway for content_text (see below), and getting out of
--     sync the moment the extraction rules change. Deriving title from
--     content's first line is instead a later ticket's server action, run at
--     save time. A brand-new note (empty content doc) therefore legitimately
--     has title = '' until the first save -- allowed and expected, not an
--     integrity bug.
--
--   - notes.content_text is `text not null default ''`, maintained by the
--     same server action that derives title, NOT a `generated always as`
--     column. Postgres generated columns are limited to expressions over
--     other columns of the same row using built-in immutable functions --
--     there is no built-in function that walks an arbitrary TipTap jsonb
--     document tree (nested paragraphs/lists/marks) and flattens it to
--     plain text. That extraction is application logic (same place title's
--     derivation lives), not SQL. content_text exists as its own persisted
--     column purely so it has something the pg_trgm index below can index
--     without re-deriving text from jsonb on every search query.
--
--   - pg_trgm indexes on notes.title/notes.content_text are added in THIS
--     migration, not deferred to Phase 7 the way recipe_schema.sql deferred
--     recipes.title/recipe_ingredients.name. That's not an inconsistency:
--     Architecture §105 already names notes.content_text explicitly for
--     pg_trgm textual search, and the ticket asks for both indexes now.
--     recipes.title/recipe_ingredients.name remain out of scope here --
--     unchanged from recipe_schema.sql's own reasoning.
--
--   - No note_tags / tags reuse here. User decision 2026-08-13 (issue #225):
--     Vision.md names "Taggen" as a core Notities action and an earlier
--     draft of #30 described tags + note_tags, but that is deferred until a
--     real design exists -- tracked at docs/open-questions.md#notes-tagging-not-designed
--     so it isn't silently dropped. public.tags (created by
--     20260730000002_recipe_schema.sql) is deliberately generic/no
--     recipe-specific column for exactly this reason, so a future note_tags
--     join table can reuse it without a migration conflict -- see that
--     file's own tags table comment.
--
--   - pg_trgm is created here with `if not exists`: no earlier migration
--     creates it (recipe_schema.sql explicitly deferred its own trgm
--     indexes to Phase 7 and never created the extension). Placed in the
--     `extensions` schema, matching config.toml's
--     `extra_search_path = ["public", "extensions"]` and the same schema
--     pgtap uses in supabase/tests/*.sql.

create extension if not exists pg_trgm with schema extensions;

-- ============================================================================
-- note_categories
-- ============================================================================

create table public.note_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Must be a value of the IconName union in components/atoms/Icon.tsx --
  -- PascalCase (e.g. 'FolderClosed'), same convention as board_columns.icon
  -- and recipe_categories.icon.
  icon text not null,
  -- Same fractional-positioning scheme as recipe_categories.position /
  -- board_columns.position (lib/boards/positioning.ts, POSITION_GAP = 1000).
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.note_categories is
  'User-defined "kanban columns" of the notes overview, one-to-one in shape '
  'with public.recipe_categories. Three are seeded per new user (Overig/'
  'Werk/Sport) by seed_default_note_categories() below, mirroring '
  'seed_default_recipe_categories() (20260730000002_recipe_schema.sql) and '
  'the Kanban default-board seed trigger (20260723000001_kanban_schema.sql, '
  '#91). "Sport" reuses the same FolderClosed icon as "Overig" -- that is '
  'the Figma design (node 4067:18615), not a bug to fix in code.';

create trigger note_categories_set_updated_at
  before update on public.note_categories
  for each row execute function public.set_updated_at();

create index note_categories_user_id_idx on public.note_categories (user_id);

alter table public.note_categories enable row level security;

create policy note_categories_select_own on public.note_categories
  for select using (user_id = (select auth.uid()));
create policy note_categories_insert_own on public.note_categories
  for insert with check (user_id = (select auth.uid()));
create policy note_categories_update_own on public.note_categories
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy note_categories_delete_own on public.note_categories
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.note_categories to authenticated;
grant select on public.note_categories to anon;
grant select, insert, update, delete on public.note_categories to service_role;

-- ============================================================================
-- notes
-- ============================================================================

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- See file-header note: mirrors recipes.category_id -> recipe_categories
  -- and board_columns -> cards. Deleting a category deletes its notes.
  category_id uuid not null references public.note_categories (id) on delete cascade,
  -- See file-header note: derived from content's first line by a server
  -- action in a later ticket (#228+), not entered separately and not
  -- trigger-derived. Empty string is a valid, expected state for a
  -- brand-new note.
  title text not null,
  -- The TipTap document. Defaults to an empty-but-valid doc so a
  -- freshly-created note round-trips through the editor with no null case
  -- to special-case client-side.
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- See file-header note: maintained by the same server action that derives
  -- title, deliberately NOT `generated always as` -- flattening a TipTap
  -- jsonb tree to plain text is application logic, not an expression
  -- Postgres's generated-column machinery can express.
  content_text text not null default '',
  -- Same fractional-positioning scheme as note_categories.position, for
  -- dragging a note between categories.
  position numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notes is
  'One row per note. title/content_text are maintained by the save server '
  'action (#228+), not by a database trigger -- see this migration''s '
  'file-header note for why. No tags/note_tags: deliberately deferred, '
  'tracked at docs/open-questions.md#notes-tagging-not-designed.';

comment on column public.notes.title is
  'Derived from content''s first line by the server action that saves a '
  'note (#228+). Empty string is valid and expected for a note with no '
  'content yet -- never enforced non-empty here.';

comment on column public.notes.content_text is
  'Flattened plain text of content, maintained by the same server action '
  'as title. Not a generated column -- see file-header note. Indexed for '
  'pg_trgm textual search (Architecture §105); will also back embeddings '
  'search in #31.';

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create index notes_user_id_idx on public.notes (user_id);
create index notes_category_id_idx on public.notes (category_id);
create index notes_title_trgm_idx on public.notes using gin (title extensions.gin_trgm_ops);
create index notes_content_text_trgm_idx on public.notes using gin (content_text extensions.gin_trgm_ops);

alter table public.notes enable row level security;

create policy notes_select_own on public.notes
  for select using (user_id = (select auth.uid()));
create policy notes_insert_own on public.notes
  for insert with check (user_id = (select auth.uid()));
create policy notes_update_own on public.notes
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_delete_own on public.notes
  for delete using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.notes to authenticated;
grant select on public.notes to anon;
grant select, insert, update, delete on public.notes to service_role;

-- ============================================================================
-- Seed: every new user gets three working note categories.
-- ============================================================================
-- Trigger-based, same approach and same reasoning as
-- seed_default_recipe_categories() (20260730000002_recipe_schema.sql) and
-- seed_default_board() (20260723000001_kanban_schema.sql, #91): a per-user
-- category seed is a per-account default, not shared data, so it belongs in
-- a handle_new_user()-style trigger, not a one-off data migration.
-- Category names/icons are hardcoded seed data, not UI copy -- same
-- precedent as 'Ontbijt'/'Lunch'/'Avond' and 'Ideeën'/'Klaar'/'Bezig'/
-- 'Afgerond', neither routed through next-intl.
create function public.seed_default_note_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.note_categories (user_id, name, icon, position)
  values
    (new.id, 'Overig', 'FolderClosed', 1000),
    (new.id, 'Werk', 'Lightbulb', 2000),
    -- Deliberately reuses FolderClosed, same as 'Overig' -- Figma design
    -- (node 4067:18615), not a copy-paste bug. See table comment.
    (new.id, 'Sport', 'FolderClosed', 3000);

  return new;
end;
$$;

create trigger on_auth_user_created_seed_note_categories
  after insert on auth.users
  for each row execute function public.seed_default_note_categories();
