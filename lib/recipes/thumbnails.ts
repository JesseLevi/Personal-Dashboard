import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import {
  stripExif,
  validateThumbnailFile,
  THUMBNAIL_MIME_EXTENSIONS,
  type AllowedThumbnailMimeType,
} from "@/lib/recipes/thumbnail-validation";
import type { ActionResult } from "@/lib/recipes/types";

// #121: upload + signed-URL delivery for the private `recipe-thumbnails`
// bucket (Architecture.md §7). Uses the request-scoped, RLS-bound Supabase
// client from lib/supabase/server.ts, not a service_role client -- the
// bucket's own storage.objects policies (20260801000001_recipe_thumbnails_
// storage.sql) already scope every operation to the caller's own
// `<user_id>/...` prefix, so no server_role escalation is needed for either
// direction (ADR-0002/0003 stays satisfied structurally: this file never
// imports a service_role key at all).
const RECIPE_THUMBNAILS_BUCKET = "recipe-thumbnails";

/**
 * Validates, EXIF-strips and uploads a recipe thumbnail under the signed-in
 * user's own path prefix. Returns the stored object path (for
 * `recipes.thumbnail_path`), never a URL -- the bucket is private, so every
 * read goes through `getRecipeThumbnailSignedUrl` below instead.
 */
export async function uploadRecipeThumbnail(file: File): Promise<ActionResult<{ path: string }>> {
  const validation = validateThumbnailFile(file);
  if (!validation.ok) return { success: false, error: validation.error };

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { success: false, error: "unauthenticated" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stripped = stripExif(bytes, file.type);
  const extension = THUMBNAIL_MIME_EXTENSIONS[file.type as AllowedThumbnailMimeType];
  const path = `${userId}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .upload(path, stripped, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[recipes] uploadRecipeThumbnail failed:", error.message);
    return { success: false, error: "upload-failed" };
  }

  return { success: true, data: { path } };
}

/**
 * Short-lived signed URL for a stored thumbnail -- never a public bucket
 * URL (Architecture.md §7). `path` must already be prefixed with the
 * caller's own user id; a mismatched prefix returns `null` without a
 * storage round trip (RLS would also reject it, this just fails fast with
 * the same "don't trust the client for ownership" shape every recepten/
 * actions.ts write uses).
 */
export async function getRecipeThumbnailSignedUrl(
  path: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !path.startsWith(`${userId}/`)) return null;

  const { data, error } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    console.error("[recipes] getRecipeThumbnailSignedUrl failed:", error?.message);
    return null;
  }
  return data.signedUrl;
}
