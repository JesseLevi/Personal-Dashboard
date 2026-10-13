import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId, requireUserId } from "@/lib/recipes/session";
import {
  THUMBNAIL_VARIANTS,
  thumbnailVariantPath,
} from "@/lib/recipes/thumbnail-processing";
import {
  STORED_OBJECT_CACHE_CONTROL,
  getObjectStore,
  keyBelongsTo,
  objectKey,
} from "@/lib/storage";
import type { Database } from "@/lib/database.types";
import { logDbError, toErrorCode } from "@/lib/sharing/actions";
import { acceptRecipeShareSchema } from "@/lib/sharing/schemas";
import type { ActionResult, PendingRecipeShare } from "@/lib/sharing/types";

// Sharing a recipe sends a copy (ADR-0036). The offer is a pending `shares`
// row; the invitee reads it through pending_recipe_shares() and accepting runs
// accept_recipe_share(), which copies the rows. The thumbnail bytes are copied
// here, in server code (ADR-0024). Anon-key server client only, never
// service_role.

// The generated row type marks every column non-null; these two can be null.
type PendingRow = Omit<
  Database["public"]["Functions"]["pending_recipe_shares"]["Returns"][number],
  "thumbnail_path" | "time_minutes"
> & { thumbnail_path: string | null; time_minutes: number | null };

const RECIPES_MODULE = "recipes";

// A stem is only trusted when it sits in the sender's own recipes folder: the
// sender can write any text into recipes.thumbnail_path, and a path that
// points into someone else's namespace must never be presigned or copied.
function isSenderStem(senderId: string, stem: string): boolean {
  return THUMBNAIL_VARIANTS.every((variant) => {
    const key = thumbnailVariantPath(stem, variant);
    return keyBelongsTo(senderId, key) && key.split("/")[1] === RECIPES_MODULE;
  });
}

async function presignCard(senderId: string, stem: string | null): Promise<string | null> {
  if (!stem || !isSenderStem(senderId, stem)) return null;
  try {
    return await getObjectStore().presignGet(thumbnailVariantPath(stem, "card"));
  } catch (error) {
    console.error("[sharing] presign recipe share thumbnail failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function toPendingRecipeShare(row: PendingRow, thumbnailUrl: string | null): PendingRecipeShare {
  return {
    shareId: row.share_id,
    recipeId: row.recipe_id,
    title: row.title,
    timeMinutes: row.time_minutes,
    thumbnailUrl,
    inviterFirstName: row.inviter_display_name?.trim() ? row.inviter_display_name.trim() : null,
    invitedAt: row.invited_at,
  };
}

async function fetchPendingRows(): Promise<PendingRow[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pending_recipe_shares");
  if (error) {
    logDbError("pendingRecipeShares", error);
    return null;
  }
  return data;
}

/** Recipes offered to the signed-in user, newest first. Empty when signed out or on a read error. */
export async function pendingRecipeShares(): Promise<PendingRecipeShare[]> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];
  const rows = await fetchPendingRows();
  if (!rows) return [];
  return Promise.all(
    rows.map(async (row) => toPendingRecipeShare(row, await presignCard(row.inviter_id, row.thumbnail_path))),
  );
}

/**
 * Copies both thumbnail variants of the sender's `sourceStem` to a new stem
 * under `userId`'s own recipes folder. Returns the new stem, or null when the
 * source is untrusted or missing or any storage call fails; never throws, and
 * never leaves a half-written pair behind.
 */
export async function copyRecipeThumbnail(
  userId: string,
  senderId: string,
  sourceStem: string,
): Promise<string | null> {
  if (!isSenderStem(senderId, sourceStem)) {
    console.error("[sharing] copyRecipeThumbnail: source stem is not the sender's");
    return null;
  }
  const destinationStem = objectKey(userId, RECIPES_MODULE, randomUUID());
  const written: string[] = [];
  try {
    const store = getObjectStore();
    for (const variant of THUMBNAIL_VARIANTS) {
      const sourceKey = thumbnailVariantPath(sourceStem, variant);
      const destinationKey = thumbnailVariantPath(destinationStem, variant);
      if (!keyBelongsTo(userId, destinationKey)) throw new Error("destination key outside the caller's prefix");
      const object = await store.get(sourceKey);
      if (!object) throw new Error(`source ${variant} variant is missing`);
      await store.put(destinationKey, object.bytes, {
        contentType: object.contentType,
        cacheControl: STORED_OBJECT_CACHE_CONTROL,
      });
      written.push(destinationKey);
    }
    return destinationStem;
  } catch (error) {
    console.error("[sharing] copyRecipeThumbnail failed:", error instanceof Error ? error.message : error);
    if (written.length > 0) {
      try {
        await getObjectStore().delete(written);
      } catch {
        // Best effort: an orphaned object is harmless and unreachable.
      }
    }
    return null;
  }
}

/**
 * Accepts a recipe offer: the RPC copies the recipe into the caller's first
 * category, then the thumbnail is copied and attached. A failed thumbnail copy
 * is logged and the recipe stays without a photo; the accept still succeeds.
 */
export async function acceptRecipeShare(input: unknown): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = acceptRecipeShareSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid-input" };
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const { userId } = auth;

  // The sender is only known from the pending list; once accepted the share is gone.
  const pending = await fetchPendingRows();
  if (!pending) return { success: false, error: "generic" };
  const offer = pending.find((row) => row.share_id === parsed.data.shareId);
  if (!offer) return { success: false, error: "not-found" };

  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase.rpc("accept_recipe_share", {
    p_share_id: parsed.data.shareId,
  });
  if (error) {
    logDbError("acceptRecipeShare", error);
    return { success: false, error: toErrorCode(error) };
  }
  const accepted = rows[0];
  if (!accepted) return { success: false, error: "generic" };

  const sourceStem: string | null = accepted.source_thumbnail_path || null;
  if (sourceStem) {
    const copiedStem = await copyRecipeThumbnail(userId, offer.inviter_id, sourceStem);
    if (copiedStem) {
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ thumbnail_path: copiedStem })
        .eq("id", accepted.recipe_id)
        .eq("user_id", userId);
      if (updateError) {
        logDbError("acceptRecipeShare (thumbnail_path)", updateError);
        try {
          await getObjectStore().delete(THUMBNAIL_VARIANTS.map((v) => thumbnailVariantPath(copiedStem, v)));
        } catch {
          // Best effort, see copyRecipeThumbnail.
        }
      }
    }
  }

  return { success: true, data: { recipeId: accepted.recipe_id } };
}
