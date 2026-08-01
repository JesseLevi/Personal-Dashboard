// Pure, framework-free validation + EXIF-stripping for #121's private
// `recipe-thumbnails` bucket -- same split as lib/recipes/units.ts (pure,
// tested directly in tests/) vs. lib/recipes/queries.ts (`import
// "server-only"`, not directly testable since that package throws outside
// a server/react-server context, including plain Node/Vitest).
// lib/recipes/thumbnails.ts is the server-only caller of everything here.
//
// No image-processing dependency (e.g. sharp) exists in this repo and
// adding a native one is out of scope for a bucket-migration ticket, so
// EXIF stripping below is a minimal, dependency-free binary parser per
// format rather than a general-purpose metadata scrubber. It removes the
// segment/chunk that actually carries EXIF (and, for JPEG, the identically
// -located XMP block) for each of the three allowed mime types; anything
// it doesn't recognise is returned unchanged rather than corrupted.

export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MiB -- kept equal to
// the `recipe-thumbnails` bucket's file_size_limit in
// supabase/migrations/20260801000001_recipe_thumbnails_storage.sql.

export const ALLOWED_THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedThumbnailMimeType = (typeof ALLOWED_THUMBNAIL_MIME_TYPES)[number];

export const THUMBNAIL_MIME_EXTENSIONS: Record<AllowedThumbnailMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedThumbnailMimeType(type: string): type is AllowedThumbnailMimeType {
  return (ALLOWED_THUMBNAIL_MIME_TYPES as readonly string[]).includes(type);
}

export type ThumbnailValidationError = "invalid-file-type" | "file-too-large";

export function validateThumbnailFile(
  file: File,
): { ok: true } | { ok: false; error: ThumbnailValidationError } {
  if (!isAllowedThumbnailMimeType(file.type)) return { ok: false, error: "invalid-file-type" };
  if (file.size > MAX_THUMBNAIL_BYTES) return { ok: false, error: "file-too-large" };
  return { ok: true };
}

export function stripExif(bytes: Uint8Array, mimeType: string): Uint8Array {
  switch (mimeType) {
    case "image/jpeg":
      return stripJpegExif(bytes);
    case "image/png":
      return stripPngExif(bytes);
    case "image/webp":
      return stripWebpExif(bytes);
    default:
      return bytes;
  }
}

// JPEG: drop the APP1 segment (marker 0xFFE1) -- the one both Exif and XMP
// live in -- and copy every other marker segment through untouched. Parsing
// stops at SOS (0xFFDA): everything from there on is entropy-coded scan
// data (which can legally contain 0xFF bytes), copied verbatim rather than
// re-parsed as markers.
function stripJpegExif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const out = new Uint8Array(bytes.length);
  out[0] = bytes[0];
  out[1] = bytes[1];
  let read = 2;
  let write = 2;

  const copyRest = () => {
    out.set(bytes.subarray(read), write);
    write += bytes.length - read;
    read = bytes.length;
  };

  while (read < bytes.length - 1) {
    if (bytes[read] !== 0xff) {
      copyRest();
      break;
    }
    const marker = bytes[read + 1];
    // Markers with no length field: TEM (0x01) and RST0-7/EOI (0xD0-0xD9).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      out[write] = bytes[read];
      out[write + 1] = bytes[read + 1];
      write += 2;
      read += 2;
      if (marker === 0xd9) break; // EOI
      continue;
    }
    if (marker === 0xda) {
      // SOS -- rest of the file is scan data, copy as-is.
      copyRest();
      break;
    }
    if (read + 3 >= bytes.length) {
      copyRest();
      break;
    }
    const length = (bytes[read + 2] << 8) | bytes[read + 3]; // includes itself
    const segmentEnd = Math.min(read + 2 + length, bytes.length);
    if (marker !== 0xe1) {
      out.set(bytes.subarray(read, segmentEnd), write);
      write += segmentEnd - read;
    }
    read = segmentEnd;
  }

  return out.subarray(0, write);
}

// PNG: drop the `eXIf` chunk (the standard PNG EXIF carrier since the 2017
// spec addition). Chunk = 4-byte length + 4-byte type + data + 4-byte CRC.
function stripPngExif(bytes: Uint8Array): Uint8Array {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || !SIGNATURE.every((b, i) => bytes[i] === b)) return bytes;

  const keep: Array<[number, number]> = [[0, 8]];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length =
      (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const chunkEnd = offset + 8 + length + 4;
    if (length < 0 || chunkEnd > bytes.length) {
      keep.push([offset, bytes.length]);
      offset = bytes.length;
      break;
    }
    if (type !== "eXIf") keep.push([offset, chunkEnd]);
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  if (offset < bytes.length) keep.push([offset, bytes.length]);

  return concatRanges(bytes, keep);
}

// WebP (RIFF container): drop the `EXIF` chunk and patch the RIFF size
// field (bytes 4-8, little-endian) to match the new total length.
function stripWebpExif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) return bytes;
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!isRiff || !isWebp) return bytes;

  const keep: Array<[number, number]> = [[0, 12]];
  let offset = 12;
  let removedAny = false;
  while (offset + 8 <= bytes.length) {
    const fourCC = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size =
      (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    const padded = size % 2 === 1 ? size + 1 : size;
    const chunkEnd = offset + 8 + padded;
    if (chunkEnd > bytes.length) {
      keep.push([offset, bytes.length]);
      offset = bytes.length;
      break;
    }
    if (fourCC === "EXIF") {
      removedAny = true;
    } else {
      keep.push([offset, chunkEnd]);
    }
    offset = chunkEnd;
  }
  if (!removedAny) return bytes;

  const out = concatRanges(bytes, keep);
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >>> 8) & 0xff;
  out[6] = (riffSize >>> 16) & 0xff;
  out[7] = (riffSize >>> 24) & 0xff;
  return out;
}

function concatRanges(bytes: Uint8Array, ranges: Array<[number, number]>): Uint8Array {
  const total = ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
  const out = new Uint8Array(total);
  let w = 0;
  for (const [s, e] of ranges) {
    out.set(bytes.subarray(s, e), w);
    w += e - s;
  }
  return out;
}
