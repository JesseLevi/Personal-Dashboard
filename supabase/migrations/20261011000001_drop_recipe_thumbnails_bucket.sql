-- #384 / ADR-0024 §7: retire the Supabase `recipe-thumbnails` bucket; recipe
-- thumbnails live in R2 now (lib/storage). Idempotent.
drop policy if exists recipe_thumbnails_select_own on storage.objects;
drop policy if exists recipe_thumbnails_insert_own on storage.objects;
drop policy if exists recipe_thumbnails_update_own on storage.objects;
drop policy if exists recipe_thumbnails_delete_own on storage.objects;

-- Never orphan files: abort if the bucket still holds any object. Supabase
-- rejects direct deletes on storage tables unless this session var is set.
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'recipe-thumbnails') then
    raise exception 'recipe-thumbnails bucket still has objects; copy them to R2 first (#384)';
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'recipe-thumbnails';
end
$$;
