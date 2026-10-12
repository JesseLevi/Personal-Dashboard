// Pure avatar pipeline (#434): magic-byte sniffing and the sharp re-encode.
// No `server-only` so Vitest can run it; lib/profile/avatar.ts is the
// server-only caller.
import sharp from "sharp";

/** Stored size: 40 CSS px (Sidebar) x 3 for high-density screens. */
export const AVATAR_SIZE = 120;
export const AVATAR_QUALITY = 80;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarImageType = "jpeg" | "png" | "webp" | "heic";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/** Sniffs the real type from the leading bytes; the client's mime type is never trusted. */
export function detectAvatarImageType(bytes: Uint8Array): AvatarImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return "png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(bytes, 8, 12))) {
    return "heic";
  }
  return null;
}

/**
 * Center-cropped 120x120 WebP. `autoOrient` applies the EXIF rotation, and
 * the WebP encoder drops all metadata (EXIF/XMP/ICC) by default. Throws on
 * corrupt or unreadable input (HEIC only works if the sharp build has a
 * HEVC decoder); the caller maps that to "invalid-image".
 */
export async function renderAvatar(bytes: Uint8Array): Promise<Uint8Array> {
  return sharp(bytes, { failOn: "none", limitInputPixels: 100_000_000 })
    .autoOrient()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: AVATAR_QUALITY })
    .toBuffer();
}
