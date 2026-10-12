import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/profile/session";
import {
  MAX_AVATAR_BYTES,
  detectAvatarImageType,
  renderAvatar,
} from "@/lib/profile/avatar-processing";
import {
  STORED_OBJECT_CACHE_CONTROL,
  getObjectStore,
  keyBelongsTo,
  objectKey,
  type ObjectStore,
} from "@/lib/storage";
import type { ActionResult } from "@/lib/profile/types";

// Profile photo (#434): one 120x120 WebP per user at
// `<user_id>/avatar/<uuid>.webp`, key stored in profiles.avatar_path.

async function readOwnPath(userId: string): Promise<string | null | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profile] avatar_path read failed:", error.code, error.message);
    return undefined;
  }
  return data?.avatar_path ?? null;
}

async function deleteOldObject(userId: string, key: string | null): Promise<void> {
  if (!key || !keyBelongsTo(userId, key)) return;
  try {
    await getObjectStore().delete([key]);
  } catch (error) {
    console.error("[profile] old avatar delete failed:", error instanceof Error ? error.message : error);
  }
}

/** Validates, re-encodes and stores the signed-in user's photo; replaces and deletes the previous one. */
export async function storeAvatar(input: unknown): Promise<ActionResult> {
  if (!(input instanceof File)) return { success: false, error: "invalid-input" };
  if (input.size > MAX_AVATAR_BYTES) return { success: false, error: "file-too-large" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const userId = auth.userId;

  const bytes = new Uint8Array(await input.arrayBuffer());
  if (bytes.length > MAX_AVATAR_BYTES) return { success: false, error: "file-too-large" };
  if (!detectAvatarImageType(bytes)) return { success: false, error: "invalid-file-type" };

  let webp: Uint8Array;
  try {
    webp = await renderAvatar(bytes);
  } catch (error) {
    console.error("[profile] renderAvatar failed:", error instanceof Error ? error.message : error);
    return { success: false, error: "invalid-image" };
  }

  const previous = await readOwnPath(userId);
  if (previous === undefined) return { success: false, error: "generic" };

  const key = objectKey(userId, "avatar", `${randomUUID()}.webp`);
  let store: ObjectStore;
  try {
    store = getObjectStore();
    await store.put(key, webp, {
      contentType: "image/webp",
      cacheControl: STORED_OBJECT_CACHE_CONTROL,
    });
  } catch (error) {
    console.error("[profile] avatar put failed:", error instanceof Error ? error.message : error);
    return { success: false, error: "upload-failed" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: key }).eq("id", userId);
  if (error) {
    console.error("[profile] avatar_path update failed:", error.code, error.message);
    await store.delete([key]).catch(() => {});
    return { success: false, error: "generic" };
  }

  await deleteOldObject(userId, previous);
  return { success: true, data: undefined };
}

/** Clears the signed-in user's photo and deletes the object. */
export async function clearAvatar(): Promise<ActionResult> {
  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };

  const previous = await readOwnPath(auth.userId);
  if (previous === undefined) return { success: false, error: "generic" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", auth.userId);
  if (error) {
    console.error("[profile] avatar_path clear failed:", error.code, error.message);
    return { success: false, error: "generic" };
  }

  await deleteOldObject(auth.userId, previous);
  return { success: true, data: undefined };
}
