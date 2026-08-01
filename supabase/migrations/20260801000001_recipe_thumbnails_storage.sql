-- #121: private `recipe-thumbnails` storage bucket (Architecture.md §4.2 /
-- §7). First bucket migration in this repo -- no precedent to copy, so the
-- pattern below (bucket row + storage.objects RLS, path prefix = user_id)
-- is the one `clothing-photos` (later phase) should mirror.
--
-- storage.objects ships with RLS already enabled and already granted
-- select/insert/update/delete to `anon`/`authenticated` by Supabase's own
-- storage extension migrations -- unlike a `public` table, this bucket
-- migration does not (and must not) re-grant those; the policies below are
-- the entire boundary, same division of labour as every other table's RLS
-- policy plus its ADR-0009 test, just scoped to one bucket_id instead of
-- one tablename.
--
-- Path convention: every object's key is `<user_id>/<filename>` --
-- `(storage.foldername(name))[1]` is the first path segment, checked
-- against the caller's own auth.uid() on all four operations, mirroring
-- every `user_id = (select auth.uid())` policy elsewhere in this project
-- (ADR-0001).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-thumbnails',
  'recipe-thumbnails',
  false,
  5242880, -- 5 MiB; kept equal to lib/recipes/thumbnails.ts's MAX_THUMBNAIL_BYTES
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy recipe_thumbnails_select_own on storage.objects
  for select
  using (
    bucket_id = 'recipe-thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_thumbnails_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'recipe-thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_thumbnails_update_own on storage.objects
  for update
  using (
    bucket_id = 'recipe-thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'recipe-thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_thumbnails_delete_own on storage.objects
  for delete
  using (
    bucket_id = 'recipe-thumbnails'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
