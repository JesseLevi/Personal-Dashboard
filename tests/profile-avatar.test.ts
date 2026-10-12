import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

const session = vi.hoisted(() => ({ userId: null as string | null }));
// profiles table + the share relation, enforced by the fake the way
// avatar_path_for does in SQL: self, or an entry in `related`.
const db = vi.hoisted(() => ({
  paths: {} as Record<string, string | null>,
  related: new Set<string>(),
  updateError: false,
}));

vi.mock("@/lib/profile/session", () => ({
  getAuthenticatedUserId: async () => session.userId,
  requireUserId: async () =>
    session.userId ? { userId: session.userId } : { error: "unauthenticated" as const },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (_fn: string, args: { p_user_id: string }) => {
      const target = args.p_user_id;
      const allowed = target === session.userId || db.related.has(`${session.userId}:${target}`);
      return { data: allowed ? (db.paths[target] ?? null) : null, error: null };
    },
    from: () => {
      let patch: { avatar_path: string | null } | null = null;
      const q = {
        select: () => q,
        update: (p: { avatar_path: string | null }) => {
          patch = p;
          return q;
        },
        eq: (_col: string, id: string) => {
          if (patch) {
            if (db.updateError) return Promise.resolve({ error: { code: "x", message: "boom" } });
            db.paths[id] = patch.avatar_path;
            return Promise.resolve({ error: null });
          }
          return q;
        },
        maybeSingle: async () => ({
          data: { avatar_path: db.paths[session.userId as string] ?? null },
          error: null,
        }),
      };
      return q;
    },
  }),
}));

import { GET } from "@/app/api/avatar/[userId]/route";
import { clearAvatar, storeAvatar } from "@/lib/profile/avatar";
import {
  AVATAR_SIZE,
  MAX_AVATAR_BYTES,
  detectAvatarImageType,
  renderAvatar,
} from "@/lib/profile/avatar-processing";
import { setObjectStoreForTesting } from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";

const A = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const B = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const C = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";

let store: ReturnType<typeof createFakeObjectStore>;

beforeEach(() => {
  store = createFakeObjectStore();
  setObjectStoreForTesting(store);
  session.userId = A;
  db.paths = {};
  db.related = new Set();
  db.updateError = false;
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.restoreAllMocks();
});

async function jpegWithExif(width = 400, height = 200): Promise<Uint8Array> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .withExif({ IFD0: { Copyright: "secret-owner", Make: "SecretCam" } })
    .jpeg()
    .toBuffer();
}

const fileOf = (bytes: Uint8Array, name = "me.jpg") => new File([new Uint8Array(bytes)], name);

describe("renderAvatar", () => {
  it("returns exactly 120x120 WebP for a landscape source (center crop)", async () => {
    const out = await renderAvatar(await jpegWithExif(400, 200));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(AVATAR_SIZE);
    expect(meta.height).toBe(AVATAR_SIZE);
  });

  it("upscales a tiny source to 120x120 too", async () => {
    const out = await renderAvatar(await jpegWithExif(30, 30));
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([AVATAR_SIZE, AVATAR_SIZE]);
  });

  it("crops from the center", async () => {
    // Left third red, middle blue, right third green; the center crop is blue.
    const third = (rgb: [number, number, number]) =>
      sharp({ create: { width: 100, height: 100, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
        .png()
        .toBuffer();
    const src = await sharp({
      create: { width: 300, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .composite([
        { input: await third([255, 0, 0]), left: 0, top: 0 },
        { input: await third([0, 0, 255]), left: 100, top: 0 },
        { input: await third([0, 255, 0]), left: 200, top: 0 },
      ])
      .png()
      .toBuffer();
    const { data, info } = await sharp(await renderAvatar(src))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels).subarray(0, 3)];
    const [r, g, b] = px(60, 60);
    expect(b).toBeGreaterThan(200);
    expect(r).toBeLessThan(60);
    expect(g).toBeLessThan(60);
  });

  it("strips EXIF and other metadata", async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await renderAvatar(input);
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Buffer.from(out).includes(Buffer.from("SecretCam"))).toBe(false);
    expect(Buffer.from(out).includes(Buffer.from("secret-owner"))).toBe(false);
  });

  it("rejects corrupt input", async () => {
    await expect(renderAvatar(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]))).rejects.toThrow();
  });
});

describe("detectAvatarImageType", () => {
  it("recognises JPEG, PNG and WebP by magic bytes", async () => {
    expect(detectAvatarImageType(await jpegWithExif())).toBe("jpeg");
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(detectAvatarImageType(png)).toBe("png");
    const webp = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).webp().toBuffer();
    expect(detectAvatarImageType(webp)).toBe("webp");
  });

  it("recognises a HEIC container and rejects everything else", () => {
    const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0]);
    expect(detectAvatarImageType(heic)).toBe("heic");
    const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0]);
    expect(detectAvatarImageType(mp4)).toBeNull();
    expect(detectAvatarImageType(new TextEncoder().encode("<svg xmlns='x'></svg>"))).toBeNull();
    expect(detectAvatarImageType(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(detectAvatarImageType(new Uint8Array())).toBeNull();
  });
});

describe("storeAvatar / clearAvatar", () => {
  it("stores one 120x120 WebP under <user>/avatar/ and points the profile at it", async () => {
    const result = await storeAvatar(fileOf(await jpegWithExif()));
    expect(result.success).toBe(true);
    const keys = [...store.objects.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(new RegExp(`^${A}/avatar/[0-9a-f-]{36}\\.webp$`));
    expect(db.paths[A]).toBe(keys[0]);
    const meta = await sharp(store.objects.get(keys[0])!.bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 120, 120]);
  });

  it("deletes the previous object on replace", async () => {
    await storeAvatar(fileOf(await jpegWithExif()));
    const first = db.paths[A]!;
    await storeAvatar(fileOf(await jpegWithExif()));
    expect(db.paths[A]).not.toBe(first);
    expect([...store.objects.keys()]).toEqual([db.paths[A]]);
  });

  it("removes the object and clears the path", async () => {
    await storeAvatar(fileOf(await jpegWithExif()));
    const result = await clearAvatar();
    expect(result.success).toBe(true);
    expect(db.paths[A]).toBeNull();
    expect(store.objects.size).toBe(0);
  });

  it("rejects non-images by content even with an image mime type", async () => {
    const file = new File([new TextEncoder().encode("<html>not an image</html>")], "x.jpg", {
      type: "image/jpeg",
    });
    expect(await storeAvatar(file)).toEqual({ success: false, error: "invalid-file-type" });
    expect(store.objects.size).toBe(0);
  });

  it("rejects files over 5 MB", async () => {
    const big = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "big.jpg");
    expect(await storeAvatar(big)).toEqual({ success: false, error: "file-too-large" });
    expect(store.objects.size).toBe(0);
  });

  it("rejects a corrupt image that passes the magic-byte check", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2, 3, 4]);
    expect(await storeAvatar(fileOf(bad))).toEqual({ success: false, error: "invalid-image" });
    expect(store.objects.size).toBe(0);
  });

  it("rejects non-File input and a signed-out caller", async () => {
    expect(await storeAvatar("nope")).toEqual({ success: false, error: "invalid-input" });
    session.userId = null;
    expect(await storeAvatar(fileOf(await jpegWithExif()))).toEqual({
      success: false,
      error: "unauthenticated",
    });
  });

  it("does not leave an orphan when the profile update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.updateError = true;
    expect(await storeAvatar(fileOf(await jpegWithExif()))).toEqual({
      success: false,
      error: "generic",
    });
    expect(store.objects.size).toBe(0);
  });
});

describe("GET /api/avatar/[userId]", () => {
  const call = (id: string) =>
    GET(new Request(`http://localhost/api/avatar/${id}`), { params: Promise.resolve({ userId: id }) });

  beforeEach(() => {
    db.paths = { [A]: `${A}/avatar/a.webp`, [B]: `${B}/avatar/b.webp`, [C]: null };
  });

  it("401 without a session", async () => {
    session.userId = null;
    expect((await call(A)).status).toBe(401);
  });

  it("lets a user fetch their own photo (302 to a presigned URL)", async () => {
    const res = await call(A);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain(`${A}/avatar/a.webp`);
  });

  it("404 for a stranger", async () => {
    expect((await call(B)).status).toBe(404);
  });

  it("lets a related member fetch the photo, in either direction", async () => {
    db.related.add(`${A}:${B}`);
    const res = await call(B);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain(`${B}/avatar/b.webp`);
    session.userId = B;
    db.related.add(`${B}:${A}`);
    expect((await call(A)).status).toBe(302);
  });

  it("404 when the user has no photo, even for self or a related member", async () => {
    session.userId = C;
    expect((await call(C)).status).toBe(404);
    session.userId = A;
    db.related.add(`${A}:${C}`);
    expect((await call(C)).status).toBe(404);
  });

  it("404 when the stored key is not in the target's namespace", async () => {
    db.paths[B] = `${A}/avatar/a.webp`;
    db.related.add(`${A}:${B}`);
    expect((await call(B)).status).toBe(404);
  });

  it("404 for a malformed id", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
  });
});
