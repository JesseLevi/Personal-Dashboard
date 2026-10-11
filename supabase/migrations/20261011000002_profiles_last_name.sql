-- #404: last name next to the first name. display_name stays and now holds the
-- FIRST name; existing profiles RLS/grants already cover the new column.
alter table public.profiles add column if not exists last_name text;

comment on column public.profiles.last_name is
  'Last name (#404); display_name holds the first name. Nullable, no DB length cap (app caps at 40).';
