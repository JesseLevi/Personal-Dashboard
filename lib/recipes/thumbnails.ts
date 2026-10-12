import "server-only";
import { randomUUID } from "node:crypto";
import { preconnect } from "react-dom";
import { getAuthenticatedUserId } from "@/lib/recipes/session";
import { validateThumbnailFile } from "@/lib/recipes/thumbnail-validation";
import {
  renderThumbnailVariants,
  thumbnailVariantPath,
  type ThumbnailVariant,
} from "@/lib/recipes/thumbnail-processing";
import {
  STORED_OBJECT_CACHE_CONTROL,
  getObjectStore,
  keyBelongsTo,
  objectKey,
  objectStoreOrigin,
  type ObjectStore,
} from "@/lib/storage";
import type { ActionResult } from "@/lib/recipes/types";

// Thumbnail bytes live in R2 (ADR-0024); `recipes.thumbnail_path` stores the
// stem `<user_id>/recipes/<uuid>`.

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
    await getObjectStore().delete(keys);
  } catch (error) {
    console.error("[recipes] deleteRecipeThumbnail failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Removes both variants of a stem the importer stored but never attached to a
 * recipe (the import failed afterwards). No session needed, it runs in
 * `after()`. Best-effort, never throws.
 */
export async function discardRecipeThumbnail(stem: string): Promise<void> {
  const keys = [thumbnailVariantPath(stem, "card"), thumbnailVariantPath(stem, "full")];
  try {
    await getObjectStore().delete(keys);
  } catch (error) {
    console.error("[recipes] discardRecipeThumbnail failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Presigned GET URL for one variant of `stem`, for a server render that already
 * loaded the owning row for `userId` (ADR-0024 §5 amendment). Null, never a
 * throw, when the stem is not the user's or R2 is not configured.
 */
export async function presignRecipeThumbnail(
  userId: string,
  stem: string | null | undefined,
  size: ThumbnailVariant,
): Promise<string | null> {
  if (!stem) return null;
  const key = thumbnailVariantPath(stem, size);
  if (!keyBelongsTo(userId, key)) return null;
  try {
    return await getObjectStore().presignGet(key);
  } catch (error) {
    console.error("[recipes] presignRecipeThumbnail failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** `recipe id -> presigned URL` for the recipes that have a resolvable thumbnail. */
export async function presignRecipeThumbnails(
  userId: string | null,
  recipes: { id: string; thumbnail_path: string | null }[],
  size: ThumbnailVariant,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!userId) return out;
  await Promise.all(
    recipes.map(async (r) => {
      const url = await presignRecipeThumbnail(userId, r.thumbnail_path, size);
      if (url) out[r.id] = url;
    }),
  );
  const origin = Object.keys(out).length > 0 ? objectStoreOrigin() : null;
  if (origin) preconnect(origin);
  return out;
}
