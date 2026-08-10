import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  ALLOWED_THUMBNAIL_MIME_TYPES,
  MAX_THUMBNAIL_BYTES,
  validateThumbnailFile,
} from "@/lib/recipes/thumbnail-validation";
import { renderThumbnailVariants, thumbnailVariantPath } from "@/lib/recipes/thumbnail-processing";

// #121: validation for the recipe-thumbnails upload path. Tested here (not
// lib/recipes/thumbnails.ts, which is `import "server-only"` and throws
// outside a server/react-server context, including plain Node/Vitest) --
// same split as tests/recipes-units.test.ts vs. queries.ts.
//
// #174/#171: the hand-rolled EXIF-stripping tests that used to live here
// are gone -- `stripExif`/`stripJpegExif`/`stripPngExif`/`stripWebpExif`
// were deleted along with the dependency-free parser they implemented (see
// lib/recipes/thumbnail-validation.ts's header). In their place: tests for
// `renderThumbnailVariants`, sharp's replacement, built with sharp itself
// rather than hand-assembled binary fixtures.

describe("validateThumbnailFile", () => {
  it("accepts every allowed mime type under the size limit", () => {
    for (const type of ALLOWED_THUMBNAIL_MIME_TYPES) {
      const file = new File([new Uint8Array(10)], "photo", { type });
      expect(validateThumbnailFile(file)).toEqual({ ok: true });
    }
  });

  it("rejects a disallowed mime type", () => {
    const file = new File([new Uint8Array(10)], "photo.gif", { type: "image/gif" });
    expect(validateThumbnailFile(file)).toEqual({ ok: false, error: "invalid-file-type" });
  });

  it("rejects a file over MAX_THUMBNAIL_BYTES", () => {
    const oversized = new Uint8Array(MAX_THUMBNAIL_BYTES + 1);
    const file = new File([oversized], "big.jpg", { type: "image/jpeg" });
    expect(validateThumbnailFile(file)).toEqual({ ok: false, error: "file-too-large" });
  });

  it("accepts a file exactly at MAX_THUMBNAIL_BYTES", () => {
    const exact = new Uint8Array(MAX_THUMBNAIL_BYTES);
    const file = new File([exact], "exact.jpg", { type: "image/jpeg" });
    expect(validateThumbnailFile(file)).toEqual({ ok: true });
  });

  it("MAX_THUMBNAIL_BYTES is 10 MiB, the new input cap decoupled from bucket storage", () => {
    expect(MAX_THUMBNAIL_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("thumbnailVariantPath", () => {
  it("appends the variant and .webp extension to the stem", () => {
    expect(thumbnailVariantPath("user-1/abc-123", "card")).toBe("user-1/abc-123_card.webp");
    expect(thumbnailVariantPath("user-1/abc-123", "full")).toBe("user-1/abc-123_full.webp");
  });
});

describe("renderThumbnailVariants", () => {
  it("renders a 288x288 WebP cover crop for the card variant", async () => {
    const source = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const { card } = await renderThumbnailVariants(source);
    const meta = await sharp(card).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(288);
    expect(meta.height).toBe(288);
  });

  it("renders a 1280-wide WebP with aspect preserved for the full variant", async () => {
    const source = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 200, g: 100, b: 50 } }, // 2:1
    })
      .jpeg()
      .toBuffer();

    const { full } = await renderThumbnailVariants(source);
    const meta = await sharp(full).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(640); // 2:1 source -> half the width
  });

  it("does not enlarge a source smaller than the target dimensions", async () => {
    const source = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const { card, full } = await renderThumbnailVariants(source);
    const cardMeta = await sharp(card).metadata();
    const fullMeta = await sharp(full).metadata();

    expect(cardMeta.width).toBe(100);
    expect(cardMeta.height).toBe(100);
    expect(fullMeta.width).toBe(100);
    expect(fullMeta.height).toBe(100);
  });

  it("strips EXIF metadata from both output variants", async () => {
    const source = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .jpeg()
      .withMetadata({ orientation: 1, exif: { IFD0: { Copyright: "test" } } })
      .toBuffer();

    const { card, full } = await renderThumbnailVariants(source);
    const cardMeta = await sharp(card).metadata();
    const fullMeta = await sharp(full).metadata();

    expect(cardMeta.exif).toBeUndefined();
    expect(fullMeta.exif).toBeUndefined();
  });

  it("honours EXIF orientation before discarding it, unlike the old stripper", async () => {
    // Orientation 6 = rotate 90deg CW for display. Raw pixel storage is
    // landscape (100x50); a correctly-oriented render is portrait (50x100).
    // The old hand-rolled stripper only deleted the EXIF segment/chunk and
    // never looked at Orientation, so a photo like this one would have come
    // out sideways -- this is the bug #174/#171 fixes.
    const source = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const { full } = await renderThumbnailVariants(source);
    const meta = await sharp(full).metadata();

    expect(meta.width).toBe(50);
    expect(meta.height).toBe(100);
    expect(meta.exif).toBeUndefined();
  });

  it("rejects garbage bytes", async () => {
    const garbage = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(renderThumbnailVariants(garbage)).rejects.toThrow();
  });
});
