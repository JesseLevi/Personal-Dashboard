// #174/#171 chunk 3: browser-only pre-resize before upload. Cuts the upload
// payload from a phone photo's several MB down to a few hundred kB --
// sharp's server-side re-encode (lib/recipes/thumbnail-processing.ts) stays
// the authority either way (client input is never trusted), this is purely
// a bandwidth/latency win on top of it. No `server-only` import: this file
// runs in the browser (RecipePanel.tsx, "use client"), the mirror image of
// why thumbnail-processing.ts/thumbnail-validation.ts deliberately omit it
// for the opposite reason (testability under Vitest).
//
// EXIF orientation: `createImageBitmap` does NOT honour EXIF orientation by
// default in every browser -- Chrome/Firefox currently default to "none",
// Safari's default has changed across versions -- so `imageOrientation:
// "from-image"` below is required, not decorative. Getting this wrong
// reintroduces the exact sideways-photo bug chunk 1 fixed server-side with
// sharp's `autoOrient()` (docs/incidents.md's EXIF-orientation entry):
// `createImageBitmap` without it would draw the raw, still-rotated pixels
// onto the canvas, and the server would then faithfully re-encode a
// sideways photo since by the time sharp sees it, the orientation
// information this canvas path discarded is already gone.
//
// Fails open, always: a resize failure (missing API, decode error, encode
// error, or a "smaller" result that isn't actually smaller) must never
// block a save. The server handles full-size input fine (10 MiB cap, 11mb
// body limit) -- this module only ever returns the original `file` on any
// doubt.

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;
// Below this input size, skip the decode/encode round trip entirely rather
// than spend it finding out the result isn't smaller -- most already-small
// images (screenshots, previously-downscaled photos) fall here. The other
// half of "already within maxEdge and reasonably small" (the dimension
// check) still needs a decode to evaluate, so it's folded into the main
// path below instead of gating a second up-front skip: if dimensions are
// already within bounds, `targetDimensions` is a no-op and the encode step
// only keeps its output when re-encoding to WebP still shrinks the file.
const SKIP_BELOW_BYTES = 400 * 1024;

export interface DownscaleImageOptions {
  maxEdge?: number;
  quality?: number;
}

/**
 * Pure sizing helper: scales `width`×`height` down so neither edge exceeds
 * `maxEdge`, preserving aspect ratio. Never enlarges (a source already
 * within bounds is returned unchanged) and always returns integers (canvas
 * dimensions can't be fractional). Extracted from the canvas path so it's
 * unit-testable without a DOM/OffscreenCanvas.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canUseCanvasResize(): boolean {
  return (
    typeof createImageBitmap === "function" &&
    (typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined")
  );
}

async function encodeToWebpFile(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  originalName: string,
): Promise<File | null> {
  const webpName = originalName.replace(/\.[^./]+$/, "") + ".webp";

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    return new File([blob], webpName, { type: "image/webp" });
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) return null;
    return new File([blob], webpName, { type: "image/webp" });
  }

  return null;
}

/**
 * Downscales `file` client-side before upload, encoding to WebP (already on
 * `ALLOWED_THUMBNAIL_MIME_TYPES`, lib/recipes/thumbnail-validation.ts, so
 * validation still passes unchanged). Always resolves -- never rejects --
 * falling back to the original `file` whenever the browser lacks the
 * required APIs, decoding/encoding throws, or the "downscaled" result isn't
 * actually smaller than the input.
 */
export async function downscaleImageFile(
  file: File,
  opts?: DownscaleImageOptions,
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts?.quality ?? DEFAULT_QUALITY;

  if (file.size <= SKIP_BELOW_BYTES || !canUseCanvasResize()) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const { width, height } = targetDimensions(bitmap.width, bitmap.height, maxEdge);
      const resized = await encodeToWebpFile(bitmap, width, height, quality, file.name);
      if (!resized || resized.size >= file.size) return file;
      return resized;
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
