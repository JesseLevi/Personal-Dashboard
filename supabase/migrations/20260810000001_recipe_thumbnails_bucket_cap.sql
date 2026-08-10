-- #174/#171: tighten the `recipe-thumbnails` bucket's file_size_limit now
-- that the app only ever writes ~20-120 kB WebP derivatives (two per
-- recipe, lib/recipes/thumbnail-processing.ts's `renderThumbnailVariants`)
-- and never stores a full-resolution original -- see
-- 20260801000001_recipe_thumbnails_storage.sql for the bucket's original
-- creation (5 MiB cap, tied 1:1 to the old MAX_THUMBNAIL_BYTES). 1 MiB here
-- is a belt-and-braces guarantee, not a tuned value: it is deliberately
-- decoupled from lib/recipes/thumbnail-validation.ts's MAX_THUMBNAIL_BYTES
-- (now 10 MiB), which caps what a user may *upload*, not what the app
-- *stores* -- if the re-encode pipeline ever regresses and tries to write
-- something bigger than a small WebP derivative, this cap makes the
-- storage API reject it outright rather than silently letting a
-- full-resolution original back into the bucket.
update storage.buckets
set file_size_limit = 1048576 -- 1 MiB
where id = 'recipe-thumbnails';
