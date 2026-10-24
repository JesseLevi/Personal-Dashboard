import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/notes/session";
import { STORED_OBJECT_CACHE_CONTROL, getObjectStore, objectKey } from "@/lib/storage";
import { MAX_NOTE_IMAGE_BYTES } from "@/lib/notes/image-limits";
import type { ActionResult } from "@/lib/notes/types";

export { MAX_NOTE_IMAGE_BYTES };

// Note images live in R2 (ADR-0022 as amended by ADR-0024) under
// `<user_id>/notes/<note_id>/<image_id>.webp`; the document stores only the
// same-origin route `/api/note-image/<note_id>/<image_id>`. Callers should run
// lib/images/downscale-client.ts first (Vercel's 4.5 MB body limit); the
// editor caller is #339.

export const MAX_NOTE_IMAGE_EDGE = 2000;
// Same decode ceiling as lib/profile/avatar-processing.ts and lib/recipes/thumbnail-processing.ts.
const MAX_INPUT_PIXELS = 100_000_000;
const SWEEP_INTERVAL_MS = 60_000;
// Fresh uploads may not be in a saved document yet; the sweep leaves them.
const SWEEP_GRACE_MS = 10 * 60_000;

const IMAGE_SRC_PATTERN = /\/api\/note-image\/([0-9a-f-]{36})\/([0-9a-f-]{36})/gi;

export function noteImageSrc(noteId: string, imageId: string): string {
  return `/api/note-image/${noteId}/${imageId}`;
}

export function noteImagePrefix(userId: string, noteId: string): string {
  return `${objectKey(userId, "notes", noteId)}/`;
}

/** True when the leading bytes are JPEG, PNG, WebP or GIF. */
export function hasImageMagicBytes(b: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b[0] === 0x89 && ascii(1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return true;
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  return ascii(0, 4) === "GIF8" && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;
}

/** Re-encodes to WebP, long side <= 2000 px; the encoder drops all metadata. Throws on undecodable input. */
export async function renderNoteImage(bytes: Uint8Array): Promise<Uint8Array> {
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .autoOrient()
    .resize({
      width: MAX_NOTE_IMAGE_EDGE,
      height: MAX_NOTE_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}

// UUIDv7: the millisecond timestamp in the id lets the sweep spare fresh uploads without state.
function newImageId(now = Date.now()): string {
  const b = randomBytes(16);
  b.writeUIntBE(now, 0, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function imageIdAgeMs(imageId: string, now: number): number {
  if (imageId[14] !== "7") return Infinity;
  const ts = parseInt(imageId.replace(/-/g, "").slice(0, 12), 16);
  return now - ts;
}

export async function uploadNoteImageForUser(
  noteId: string,
  file: File,
): Promise<ActionResult<{ src: string }>> {
  if (file.size > MAX_NOTE_IMAGE_BYTES) return { success: false, error: "file-too-large" };

  const auth = await requireUserId();
  if ("error" in auth) return { success: false, error: auth.error };
  const { userId } = auth;

  const supabase = await createSupabaseServerClient();
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (noteError) {
    console.error("[notes] uploadNoteImage lookup failed:", noteError.message);
    return { success: false, error: "generic" };
  }
  if (!note) return { success: false, error: "not-found" };

  const input = new Uint8Array(await file.arrayBuffer());
  if (input.length > MAX_NOTE_IMAGE_BYTES) return { success: false, error: "file-too-large" };
  if (!hasImageMagicBytes(input)) return { success: false, error: "invalid-file-type" };

  let output: Uint8Array;
  try {
    output = await renderNoteImage(input);
  } catch (error) {
    console.error("[notes] renderNoteImage failed:", error instanceof Error ? error.message : error);
    return { success: false, error: "invalid-image" };
  }

  const imageId = newImageId();
  try {
    await getObjectStore().put(objectKey(userId, "notes", noteId, `${imageId}.webp`), output, {
      contentType: "image/webp",
      cacheControl: STORED_OBJECT_CACHE_CONTROL,
    });
  } catch (error) {
    console.error("[notes] uploadNoteImage put failed:", error instanceof Error ? error.message : error);
    return { success: false, error: "upload-failed" };
  }
  return { success: true, data: { src: noteImageSrc(noteId, imageId) } };
}

/** Image ids of `noteId` referenced anywhere in the document JSON. */
export function referencedImageIds(content: unknown, noteId: string): Set<string> {
  const ids = new Set<string>();
  for (const m of JSON.stringify(content).matchAll(IMAGE_SRC_PATTERN)) {
    if (m[1].toLowerCase() === noteId.toLowerCase()) ids.add(m[2].toLowerCase());
  }
  return ids;
}

/** Removes every image of a note (deleteNote). Best-effort: logs, never throws. */
export async function deleteNoteImages(userId: string, noteId: string): Promise<void> {
  try {
    await getObjectStore().deletePrefix(noteImagePrefix(userId, noteId));
  } catch (error) {
    console.error("[notes] deleteNoteImages failed:", error instanceof Error ? error.message : error);
  }
}

const lastSweep = new Map<string, number>();

/**
 * Deletes images under the note's prefix that `content` no longer references
 * (ADR-0022 §6): at most once a minute per note (per server instance), sparing
 * uploads younger than 10 minutes. Best-effort: logs, never throws.
 */
export async function sweepNoteImages(
  userId: string,
  noteId: string,
  content: unknown,
  now = Date.now(),
): Promise<number> {
  const last = lastSweep.get(noteId);
  if (last !== undefined && now - last < SWEEP_INTERVAL_MS) return 0;
  lastSweep.set(noteId, now);
  try {
    const store = getObjectStore();
    const prefix = noteImagePrefix(userId, noteId);
    const referenced = referencedImageIds(content, noteId);
    const stale = (await store.list(prefix)).filter((key) => {
      const m = /^([0-9a-f-]{36})\.webp$/i.exec(key.slice(prefix.length));
      if (!m) return false;
      const id = m[1].toLowerCase();
      return !referenced.has(id) && imageIdAgeMs(id, now) > SWEEP_GRACE_MS;
    });
    if (stale.length > 0) await store.delete(stale);
    return stale.length;
  } catch (error) {
    console.error("[notes] sweepNoteImages failed:", error instanceof Error ? error.message : error);
    return 0;
  }
}

/** Test-only: clears the per-note sweep throttle. */
export function resetSweepThrottleForTesting(): void {
  lastSweep.clear();
}
