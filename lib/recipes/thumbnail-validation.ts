// Pure, framework-free validation for #121's recipe thumbnail uploads
// (stored in R2 via lib/storage) -- same split as lib/recipes/units.ts (pure, tested directly in
// tests/) vs. lib/recipes/queries.ts (`import "server-only"`, not directly
// testable since that package throws outside a server/react-server
// context, including plain Node/Vitest). lib/recipes/thumbnails.ts is the
// server-only caller of everything here.
//
// #174/#171: this module used to also do EXIF stripping with a hand-rolled
// per-format binary parser, on the grounds that no image-processing
// dependency existed in this repo and adding a native one was out of scope
// for a bucket-migration ticket. #174 makes that false: sharp is now a
// dependency (lib/recipes/thumbnail-processing.ts), and its WebP encoder
// strips ALL metadata (EXIF/XMP/ICC/IPTC) from its output by default --
// strictly more than the old parser did, since it also honours the EXIF
// Orientation tag (rotating pixels to match) before discarding it, instead
// of just deleting the segment/chunk and leaving a sideways photo. This
// module now keeps only the pre-decode gate: mime type + size, checked
// before a single byte is handed to sharp.

export const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10 MiB -- this is
// the *input* cap (what a user may hand us), fully decoupled from what we
// *store*: every upload is re-encoded server-side into ~20-120 kB WebP
// derivatives (lib/recipes/thumbnail-processing.ts), so a large original
// never reaches the bucket. The previous 5 MiB figure was tied to the
// bucket's own file_size_limit, which no longer makes sense once the
// bucket only ever receives small derivatives (see
// supabase/migrations/20260801000001_recipe_thumbnails_storage.sql and its
// #174 follow-up) -- and 5 MiB was rejecting real phone photos for no good
// reason, since modern phone cameras routinely produce 5-10+ MiB JPEGs.

export const ALLOWED_THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedThumbnailMimeType = (typeof ALLOWED_THUMBNAIL_MIME_TYPES)[number];

export function isAllowedThumbnailMimeType(type: string): type is AllowedThumbnailMimeType {
  return (ALLOWED_THUMBNAIL_MIME_TYPES as readonly string[]).includes(type);
}

export type ThumbnailValidationError = "invalid-file-type" | "file-too-large";

export function validateThumbnailFile(
  file: File,
): { ok: true } | { ok: false; error: ThumbnailValidationError } {
  if (!isAllowedThumbnailMimeType(file.type)) return { ok: false, error: "invalid-file-type" };
  if (file.size > MAX_THUMBNAIL_BYTES) return { ok: false, error: "file-too-large" };
  return { ok: true };
}
