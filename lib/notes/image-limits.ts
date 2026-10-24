// Shared by the server (lib/notes/images.ts) and the editor (lib/notes/image-upload.ts):
// no imports, so the server graph never pulls in TipTap.
export const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;

const NOTE_IMAGE_SRC = /^\/api\/note-image\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

/** True for the same-origin delivery route of #338 -- the only `src` a note image may carry. */
export function isNoteImageSrc(src: unknown): src is string {
  return typeof src === "string" && NOTE_IMAGE_SRC.test(src);
}
