import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = vi.hoisted(() => ({ userId: null as string | null }));
const db = vi.hoisted(() => ({
  notes: [] as { id: string; user_id: string; category_id?: string }[],
}));

vi.mock("@/lib/boards/session", () => ({
  getAuthenticatedUserId: async () => session.userId,
  requireUserId: async () =>
    session.userId ? { userId: session.userId } : { error: "unauthenticated" as const },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async () => ({ error: null }),
    from: () => {
      const filters: Record<string, string> = {};
      let deleting = false;
      const match = () =>
        db.notes.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
      const q = {
        select: () => q,
        delete: () => {
          deleting = true;
          return q;
        },
        eq: (col: string, val: string) => {
          filters[col] = val;
          return q;
        },
        maybeSingle: async () => {
          const row = match()[0] ?? null;
          if (deleting && row) db.notes = db.notes.filter((r) => r !== row);
          return { data: row, error: null };
        },
      };
      return q;
    },
  }),
}));

import { GET } from "@/app/api/note-image/[noteId]/[imageId]/route";
import { deleteNote, updateNoteContent, uploadNoteImage } from "@/app/(app)/notities/actions";
import { hasImageMagicBytes, resetSweepThrottleForTesting, sweepNoteImages } from "@/lib/notes/images";
import { STORED_OBJECT_CACHE_CONTROL, setObjectStoreForTesting } from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";

const A = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const B = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const NOTE = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";
const LATER = 11 * 60_000; // past the 10-minute upload grace

let store: ReturnType<typeof createFakeObjectStore>;

beforeEach(() => {
  store = createFakeObjectStore();
  setObjectStoreForTesting(store);
  session.userId = A;
  db.notes = [{ id: NOTE, user_id: A }];
  resetSweepThrottleForTesting();
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function png(width = 400, height = 300): Promise<File> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: { r: 9, g: 9, b: 9 } } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(bytes)], "x.png", { type: "image/png" });
}

async function upload(file?: File) {
  const result = await uploadNoteImage(NOTE, file ?? (await png()));
  if (!result.success) throw new Error(result.error);
  const imageId = result.data.src.split("/").pop()!;
  return { src: result.data.src, imageId, key: `${A}/notes/${NOTE}/${imageId}.webp` };
}

const docWith = (src: string) => ({ type: "doc", content: [{ type: "image", attrs: { src } }] });
const call = (noteId: string, imageId: string) =>
  GET(new Request("http://x"), { params: Promise.resolve({ noteId, imageId }) });

describe("uploadNoteImage", () => {
  it("stores WebP under <user>/notes/<note>/ with immutable cache control", async () => {
    const { src, key } = await upload();
    expect(src).toMatch(new RegExp(`^/api/note-image/${NOTE}/[0-9a-f-]{36}$`));
    const o = store.objects.get(key)!;
    expect(o.contentType).toBe("image/webp");
    expect(o.cacheControl).toBe(STORED_OBJECT_CACHE_CONTROL);
  });

  it("downsizes to 2000 px on the long side and strips EXIF", async () => {
    const big = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#123456" } })
      .withExif({ IFD0: { Copyright: "secret" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(big).metadata()).exif).toBeDefined();
    const { key } = await upload(new File([new Uint8Array(big)], "b.jpg", { type: "image/jpeg" }));
    const meta = await sharp(store.objects.get(key)!.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(2000);
    expect(meta.height).toBe(1000);
    expect(meta.exif).toBeUndefined();
  });

  it("rejects wrong magic bytes despite an image mime type", async () => {
    const file = new File([new Uint8Array(64).fill(7)], "x.png", { type: "image/png" });
    expect(await uploadNoteImage(NOTE, file)).toEqual({ success: false, error: "invalid-file-type" });
    expect(store.objects.size).toBe(0);
  });

  it("rejects corrupt images with valid magic bytes", async () => {
    const bytes = new Uint8Array(64);
    bytes.set([0xff, 0xd8, 0xff]);
    const file = new File([bytes], "x.jpg", { type: "image/jpeg" });
    expect(await uploadNoteImage(NOTE, file)).toEqual({ success: false, error: "invalid-image" });
  });

  it("rejects input over 10 MiB", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "x.png", { type: "image/png" });
    expect(await uploadNoteImage(NOTE, file)).toEqual({ success: false, error: "file-too-large" });
  });

  it("recognises jpeg, png, webp and gif signatures", () => {
    const pad = (a: number[]) => Uint8Array.from([...a, ...new Array(16).fill(0)]);
    expect(hasImageMagicBytes(pad([0xff, 0xd8, 0xff]))).toBe(true);
    expect(hasImageMagicBytes(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasImageMagicBytes(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe(true);
    expect(hasImageMagicBytes(Uint8Array.from(Buffer.from("RIFF0000WEBP")))).toBe(true);
    expect(hasImageMagicBytes(pad([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });

  it("rejects invalid note id and signed-out callers", async () => {
    expect(await uploadNoteImage("nope", await png())).toEqual({ success: false, error: "invalid-input" });
    session.userId = null;
    expect(await uploadNoteImage(NOTE, await png())).toEqual({ success: false, error: "unauthenticated" });
  });

  it("user B cannot upload to user A's note", async () => {
    session.userId = B;
    expect(await uploadNoteImage(NOTE, await png())).toEqual({ success: false, error: "not-found" });
    expect(store.objects.size).toBe(0);
  });
});

describe("GET /api/note-image", () => {
  it("302s the owner to a presigned URL", async () => {
    const { imageId, key } = await upload();
    const res = await call(NOTE, imageId);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(key);
  });

  it("404s for user B, 401 signed out, 404 for a malformed id", async () => {
    const { imageId } = await upload();
    session.userId = B;
    expect((await call(NOTE, imageId)).status).toBe(404);
    session.userId = null;
    expect((await call(NOTE, imageId)).status).toBe(401);
    session.userId = A;
    expect((await call(NOTE, "../x")).status).toBe(404);
  });
});

describe("deleteNote", () => {
  it("removes the note's images; user B cannot delete them", async () => {
    const { key } = await upload();
    store.objects.set(`${A}/notes/other-note/x.webp`, store.objects.get(key)!);
    session.userId = B;
    expect(await deleteNote({ noteId: NOTE })).toEqual({ success: false, error: "not-found" });
    expect(store.objects.has(key)).toBe(true);
    session.userId = A;
    expect((await deleteNote({ noteId: NOTE })).success).toBe(true);
    expect(store.objects.has(key)).toBe(false);
    expect(store.objects.size).toBe(1);
  });
});

describe("sweep on updateNoteContent", () => {
  it("removes unreferenced images on a later save, keeps referenced ones", async () => {
    const keep = await upload();
    const drop = await upload();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + LATER);
    expect((await updateNoteContent({ noteId: NOTE, content: docWith(keep.src) })).success).toBe(true);
    expect(store.objects.has(keep.key)).toBe(true);
    expect(store.objects.has(drop.key)).toBe(false);
  });

  it("spares uploads younger than the grace period", async () => {
    const fresh = await upload();
    expect(await sweepNoteImages(A, NOTE, docWith("x"))).toBe(0);
    expect(store.objects.has(fresh.key)).toBe(true);
  });

  it("is throttled to once per minute per note", async () => {
    const a = await upload();
    const t = Date.now() + LATER;
    expect(await sweepNoteImages(A, NOTE, docWith("x"), t)).toBe(1);
    expect(store.objects.has(a.key)).toBe(false);
    const b = await upload();
    expect(await sweepNoteImages(A, NOTE, docWith("x"), t + 30_000)).toBe(0);
    expect(store.objects.has(b.key)).toBe(true);
    expect(await sweepNoteImages(A, NOTE, docWith("x"), t + 61_000)).toBe(1);
    expect(store.objects.has(b.key)).toBe(false);
  });

  it("does not fail the save when the sweep errors", async () => {
    vi.spyOn(store, "list").mockRejectedValue(new Error("r2 down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await updateNoteContent({ noteId: NOTE, content: docWith("x") })).success).toBe(true);
  });
});
