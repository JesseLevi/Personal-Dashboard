import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { validateThumbnailFile } from "@/lib/recipes/thumbnail-validation";
import {
  isLegacyThumbnailStem,
  renderThumbnailVariants,
  thumbnailVariantPath,
  type ThumbnailVariant,
} from "@/lib/recipes/thumbnail-processing";
import { STORED_OBJECT_CACHE_CONTROL, getObjectStore, objectKey, type ObjectStore } from "@/lib/storage";
import type { ActionResult } from "@/lib/recipes/types";

// Thumbnail bytes live in R2 (ADR-0024); `recipes.thumbnail_path` stores the
// stem `<user_id>/recipes/<uuid>`. Legacy `<user_id>/<uuid>` stems still point
// at the Supabase bucket until #364 drops it.
const LEGACY_BUCKET = "recipe-thumbnails";

/** Validates and stores a manually picked thumbnail for the signed-in user; returns the stem, never a URL. */
export async function uploadRecipeThumbnail(file: File): Promise<ActionResult<{ path: string }>> {
  const validation = validateThumbnailFile(file);
  if (!validation.ok) return { success: false, error: validation.error };

  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: "unauthenticated" };

  return storeRecipeThumbnail(userId, new Uint8Array(await file.arrayBuffer()));
}

/**
 * Re-encodes `bytes` and puts both variants in R2 under `<userId>/recipes/<uuid>`.
 * Shared by the manual upload and the importer (runs inside `after()`, so no
 * request context is needed). The caller owns input validation.
 */
export async function storeRecipeThumbnail(
  userId: string,
  bytes: Uint8Array,
): Promise<ActionResult<{ path: string }>> {
  let variants: Record<ThumbnailVariant, Uint8Array>;
  try {
    variants = await renderThumbnailVariants(bytes);
  } catch (error) {
    console.error("[recipes] renderThumbnailVariants failed:", error);
    return { success: false, error: "invalid-image" };
  }

  const stem = objectKey(userId, "recipes", randomUUID());
  const cardKey = thumbnailVariantPath(stem, "card");
  const fullKey = thumbnailVariantPath(stem, "full");
  const options = { contentType: "image/webp", cacheControl: STORED_OBJECT_CACHE_CONTROL };
  let store: ObjectStore;
  try {
    // Throws when R2 env is unset; map to upload-failed instead of crashing.
    store = getObjectStore();
    await store.put(cardKey, variants.card, options);
  } catch (error) {
    console.error("[recipes] storeRecipeThumbnail (card) failed:", error instanceof Error ? error.message : error);
    return { success: false, error: "upload-failed" };
  }

  try {
    await store.put(fullKey, variants.full, options);
  } catch (error) {
    console.error("[recipes] storeRecipeThumbnail (full) failed:", error instanceof Error ? error.message : error);
    // Don't leave an orphaned half-pair: the card variant already landed.
    await store.delete([cardKey]).catch(() => {});
    return { success: false, error: "upload-failed" };
  }

  return { success: true, data: { path: stem } };
}

/**
 * Removes both variants of a thumbnail `stem` (deleteRecipe). Fails fast when
 * the stem is not under the caller's own prefix. Best-effort: logs and
 * swallows errors so the recipe row can be deleted regardless.
 */
export async function deleteRecipeThumbnail(stem: string): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId || !stem.startsWith(`${userId}/`)) return;

  const keys = [thumbnailVariantPath(stem, "card"), thumbnailVariantPath(stem, "full")];
  try {
    if (isLegacyThumbnailStem(stem)) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.storage.from(LEGACY_BUCKET).remove(keys);
      if (error) console.error("[recipes] deleteRecipeThumbnail (legacy) failed:", error.message);
    } else {
      await getObjectStore().delete(keys);
    }
  } catch (error) {
    console.error("[recipes] deleteRecipeThumbnail failed:", error instanceof Error ? error.message : error);
  }
}
