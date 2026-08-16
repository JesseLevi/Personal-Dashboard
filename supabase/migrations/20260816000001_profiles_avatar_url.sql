-- #265: adds a nullable avatar_url column to public.profiles, so the
-- Sidebar account row can render a real image when one is set (falls back
-- to an initials placeholder in the UI when null). No upload UI is built
-- this ticket (undesigned, out of scope per the brief) -- this column stays
-- null for every account until a future ticket adds a write path.
--
-- No new table, so no new RLS policy is needed -- profiles already carries
-- all four (select/insert/update/delete own row,
-- 20260720000001_profiles.sql) and they already cover every column on the
-- row, this one included.

alter table public.profiles
  add column avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the user''s avatar image. Null until a future ticket adds an upload flow (#265 only reads it).';
