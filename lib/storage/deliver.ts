// Delivery helper (ADR-0024 §5): session + ownership check, then 302 to a presigned GET.
import "server-only";
import { NextResponse } from "next/server";
import { getObjectStore } from "./index";
import { keyBelongsTo } from "./keys";

/** Pass to `put` for stored objects: keys are content-unique, so immutable is safe. */
export const STORED_OBJECT_CACHE_CONTROL = "private, max-age=31536000, immutable";

export type RedirectToStoredObjectOptions = {
  /** Session user id, or null when signed out (-> 401). */
  userId: string | null;
  /** Runs on the RLS-bound client; returns the key from the owning row, or null (-> 404). */
  ownerCheck: (userId: string) => Promise<string | null>;
  /**
   * Whose namespace the key must live in. Defaults to `userId`; set when the
   * viewer may read another user's object (a shared member's avatar) and
   * `ownerCheck` has already proven access.
   */
  keyOwnerId?: string;
};

export async function redirectToStoredObject({
  userId,
  ownerCheck,
  keyOwnerId,
}: RedirectToStoredObjectOptions): Promise<NextResponse> {
  if (!userId) return new NextResponse(null, { status: 401 });

  let key: string | null;
  try {
    key = await ownerCheck(userId);
  } catch (error) {
    console.error("[storage] ownerCheck failed:", error instanceof Error ? error.message : error);
    return new NextResponse(null, { status: 404 });
  }
  if (!key || !keyBelongsTo(keyOwnerId ?? userId, key)) return new NextResponse(null, { status: 404 });

  const url = await getObjectStore().presignGet(key);
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "private, max-age=1800",
      "Referrer-Policy": "no-referrer",
    },
  });
}
