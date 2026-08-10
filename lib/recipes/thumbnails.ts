import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { validateThumbnailFile } from "@/lib/recipes/thumbnail-validation";
import {
  renderThumbnailVariants,
  thumbnailVariantPath,
  type ThumbnailVariant,
} from "@/lib/recipes/thumbnail-processing";
import type { ActionResult } from "@/lib/recipes/types";

// #121: upload + signed-URL delivery for the private `recipe-thumbnails`
// bucket (Architecture.md §7). Uses the request-scoped, RLS-bound Supabase
// client from lib/supabase/server.ts, not a service_role client -- the
// bucket's own storage.objects policies (20260801000001_recipe_thumbnails_
// storage.sql) already scope every operation to the caller's own
// `<user_id>/...` prefix, so no server_role escalation is needed for either
// direction (ADR-0002/0003 stays satisfied structurally: this file never
// imports a service_role key at all).
//
// #174/#171 path convention change: `recipes.thumbnail_path` now stores a
// *stem* -- `<user_id>/<uuid>`, no extension -- not a full object path. Two
// real objects exist per stem, named by lib/recipes/thumbnail-processing.
// ts's `thumbnailVariantPath`: `<stem>_card.webp` and `<stem>_full.webp`.
// RLS is unaffected by this: `(storage.foldername(name))[1]` (the first
// path segment) is still the user id for both variant object names, same
// as it was for the old single-file `<user_id>/<uuid>.<ext>` names.
const RECIPE_THUMBNAILS_BUCKET = "recipe-thumbnails";

/**
 * Validates, re-encodes (lib/recipes/thumbnail-processing.ts's
 * `renderThumbnailVariants` -- two WebP derivatives, no original ever
 * stored) and uploads a recipe thumbnail under the signed-in user's own
 * path prefix. Returns the stored stem (for `recipes.thumbnail_path`),
 * never a URL -- the bucket is private, so every read goes through
 * `getRecipeThumbnailSignedUrl`/`getRecipeThumbnailSignedUrls` below
 * instead.
 */
export async function uploadRecipeThumbnail(file: File): Promise<ActionResult<{ path: string }>> {
  const validation = validateThumbnailFile(file);
  if (!validation.ok) return { success: false, error: validation.error };

  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { success: false, error: "unauthenticated" };

  const bytes = new Uint8Array(await file.arrayBuffer());

  let variants: Record<ThumbnailVariant, Uint8Array>;
  try {
    variants = await renderThumbnailVariants(bytes);
  } catch (error) {
    console.error("[recipes] renderThumbnailVariants failed:", error);
    return { success: false, error: "invalid-image" };
  }

  const stem = `${userId}/${randomUUID()}`;
  const cardPath = thumbnailVariantPath(stem, "card");
  const fullPath = thumbnailVariantPath(stem, "full");

  const { error: cardError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .upload(cardPath, variants.card, { contentType: "image/webp", upsert: false });
  if (cardError) {
    console.error("[recipes] uploadRecipeThumbnail (card) failed:", cardError.message);
    return { success: false, error: "upload-failed" };
  }

  const { error: fullError } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .upload(fullPath, variants.full, { contentType: "image/webp", upsert: false });
  if (fullError) {
    console.error("[recipes] uploadRecipeThumbnail (full) failed:", fullError.message);
    // Don't leave an orphaned half-pair: the card variant already landed.
    await supabase.storage.from(RECIPE_THUMBNAILS_BUCKET).remove([cardPath]);
    return { success: false, error: "upload-failed" };
  }

  return { success: true, data: { path: stem } };
}

/**
 * Removes both stored variant objects for a thumbnail `stem` (#149,
 * deleteRecipe in app/(app)/recepten/actions.ts). `stem` must already be
 * prefixed with the caller's own user id -- same fail-fast-without-a-
 * round-trip guard as `getRecipeThumbnailSignedUrl` below. Best-effort by
 * design: logs and swallows its own error rather than throwing, because
 * the caller must be able to delete the recipe row regardless of whether
 * this cleanup succeeds.
 */
export async function deleteRecipeThumbnail(stem: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !stem.startsWith(`${userId}/`)) return;

  const { error } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .remove([thumbnailVariantPath(stem, "card"), thumbnailVariantPath(stem, "full")]);
  if (error) {
    console.error("[recipes] deleteRecipeThumbnail failed:", error.message);
  }
}

/**
 * Short-lived signed URL for one variant of a stored thumbnail -- never a
 * public bucket URL (Architecture.md §7). `stem` must already be prefixed
 * with the caller's own user id; a mismatched prefix returns `null`
 * without a storage round trip (RLS would also reject it, this just fails
 * fast with the same "don't trust the client for ownership" shape every
 * recepten/actions.ts write uses).
 */
export async function getRecipeThumbnailSignedUrl(
  stem: string,
  variant: ThumbnailVariant,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !stem.startsWith(`${userId}/`)) return null;

  const { data, error } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .createSignedUrl(thumbnailVariantPath(stem, variant), expiresInSeconds);

  if (error || !data) {
    console.error("[recipes] getRecipeThumbnailSignedUrl failed:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Batched form of `getRecipeThumbnailSignedUrl` (#171): one auth check and
 * one storage round trip (Supabase's plural `createSignedUrls`) for a
 * whole page of recipes, instead of one round trip per recipe. Stems
 * failing the same user-id-prefix guard as the singular helper are skipped
 * rather than included with a `null` value -- callers only need to know
 * which stems actually resolved.
 */
export async function getRecipeThumbnailSignedUrls(
  stems: string[],
  variant: ThumbnailVariant,
  expiresInSeconds = 60,
): Promise<Record<string, string>> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return {};

  const ownStems = stems.filter((stem) => stem.startsWith(`${userId}/`));
  if (ownStems.length === 0) return {};

  const paths = ownStems.map((stem) => thumbnailVariantPath(stem, variant));
  const { data, error } = await supabase.storage
    .from(RECIPE_THUMBNAILS_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);

  if (error || !data) {
    console.error("[recipes] getRecipeThumbnailSignedUrls failed:", error?.message);
    return {};
  }

  const urls: Record<string, string> = {};
  data.forEach((entry, index) => {
    if (!entry.error && entry.signedUrl) urls[ownStems[index]] = entry.signedUrl;
  });
  return urls;
}
