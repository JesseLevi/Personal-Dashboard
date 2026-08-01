import { describe, expect, it } from "vitest";
import {
  ALLOWED_THUMBNAIL_MIME_TYPES,
  MAX_THUMBNAIL_BYTES,
  stripExif,
  validateThumbnailFile,
} from "@/lib/recipes/thumbnail-validation";

// #121: validation + EXIF-stripping for the recipe-thumbnails upload path.
// Tested here (not lib/recipes/thumbnails.ts, which is `import "server-only"`
// and throws outside a server/react-server context, including plain
// Node/Vitest) -- same split as tests/recipes-units.test.ts vs. queries.ts.

function bytesToString(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function includesAscii(bytes: Uint8Array, needle: string): boolean {
  const target = Array.from(needle).map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j] !== target[j]) continue outer;
    }
    return true;
  }
  return false;
}

// Minimal-but-structurally-real JPEG: SOI, an APP0/JFIF segment (kept), an
// APP1/Exif segment (must be stripped), then SOS + fake scan data + EOI.
function buildJpegWithExif(): Uint8Array {
  const app0Data = [...Array.from("JFIF\0").map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const exifData = [
    ...Array.from("Exif\0\0").map((c) => c.charCodeAt(0)),
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
  ];
  const bytes = [
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    app0Data.length + 2,
    ...app0Data, // APP0/JFIF
    0xff,
    0xe1,
    0x00,
    exifData.length + 2,
    ...exifData, // APP1/Exif
    0xff,
    0xda,
    0x00,
    0x04,
    0xaa,
    0xbb, // SOS header
    0x11,
    0x22,
    0x33,
    0x44, // fake entropy-coded scan data
    0xff,
    0xd9, // EOI
  ];
  return Uint8Array.from(bytes);
}

// Minimal PNG: signature, IHDR (kept), eXIf (must be stripped), IEND.
function buildPngWithExif(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const length = data.length;
    const lengthBytes = [(length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff];
    const typeBytes = Array.from(type).map((c) => c.charCodeAt(0));
    const crcBytes = [0, 0, 0, 0]; // not validated by stripPngExif
    return [...lengthBytes, ...typeBytes, ...data, ...crcBytes];
  };
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = chunk("IHDR", new Array(13).fill(0));
  const exif = chunk("eXIf", [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]);
  const iend = chunk("IEND", []);
  return Uint8Array.from([...signature, ...ihdr, ...exif, ...iend]);
}

// Minimal WebP (RIFF): header, a VP8 payload chunk (kept), an EXIF chunk
// (must be stripped, odd-length to also exercise RIFF padding).
function buildWebpWithExif(): Uint8Array {
  const chunk = (fourCC: string, data: number[]) => {
    const size = data.length;
    const sizeBytes = [size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff];
    const fourCCBytes = Array.from(fourCC).map((c) => c.charCodeAt(0));
    const padded = size % 2 === 1 ? [...data, 0] : data;
    return [...fourCCBytes, ...sizeBytes, ...padded];
  };
  const vp8 = chunk("VP8 ", [1, 2, 3, 4]);
  const exif = chunk("EXIF", [0x4d, 0x4d, 0x00, 0x2a, 5]); // odd length -> padded
  const body = [...vp8, ...exif];
  const riffSize = 4 + body.length; // "WEBP" + body
  const header = [
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    riffSize & 0xff,
    (riffSize >>> 8) & 0xff,
    (riffSize >>> 16) & 0xff,
    (riffSize >>> 24) & 0xff,
    0x57,
    0x45,
    0x42,
    0x50, // "WEBP"
  ];
  return Uint8Array.from([...header, ...body]);
}

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
});

describe("stripExif", () => {
  it("removes the APP1/Exif segment from a JPEG, keeps APP0 and scan data", () => {
    const input = buildJpegWithExif();
    const output = stripExif(input, "image/jpeg");

    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    expect(output[output.length - 2]).toBe(0xff);
    expect(output[output.length - 1]).toBe(0xd9);
    expect(includesAscii(output, "Exif")).toBe(false);
    expect(includesAscii(output, "JFIF")).toBe(true);
    expect(output.length).toBeLessThan(input.length);
  });

  it("removes the eXIf chunk from a PNG, keeps IHDR and IEND", () => {
    const input = buildPngWithExif();
    const output = stripExif(input, "image/png");

    // Signature preserved.
    expect(bytesToString(output, 1, 3)).toBe("PNG");
    expect(includesAscii(output, "eXIf")).toBe(false);
    expect(includesAscii(output, "IHDR")).toBe(true);
    expect(includesAscii(output, "IEND")).toBe(true);
    expect(output.length).toBeLessThan(input.length);
  });

  it("removes the EXIF chunk from a WebP and patches the RIFF size", () => {
    const input = buildWebpWithExif();
    const output = stripExif(input, "image/webp");

    expect(bytesToString(output, 0, 4)).toBe("RIFF");
    expect(bytesToString(output, 8, 4)).toBe("WEBP");
    expect(includesAscii(output, "EXIF")).toBe(false);
    expect(includesAscii(output, "VP8 ")).toBe(true);

    const riffSize =
      output[4] | (output[5] << 8) | (output[6] << 16) | (output[7] << 24);
    expect(riffSize).toBe(output.length - 8);
  });

  it("returns bytes unchanged for an unrecognised mime type", () => {
    const input = Uint8Array.from([1, 2, 3, 4]);
    expect(stripExif(input, "application/octet-stream")).toEqual(input);
  });

  it("returns bytes unchanged when a JPEG carries no APP1 segment", () => {
    const input = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]); // SOI + EOI only
    const output = stripExif(input, "image/jpeg");
    expect(output).toEqual(input);
  });
});
