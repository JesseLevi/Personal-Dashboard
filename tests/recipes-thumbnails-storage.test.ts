import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

const session = vi.hoisted(() => ({ userId: null as string | null }));
const db = vi.hoisted(() => ({
  rows: [] as { id: string; user_id: string; thumbnail_path: string | null }[],
  remove: vi.fn<(keys: string[]) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null })),
  download: vi.fn<(key: string) => Promise<{ data: Blob | null; error: null }>>(async () => ({ data: new Blob(["legacy"]), error: null })),
}));

vi.mock("@/lib/recipes/session", () => ({ getAuthenticatedUserId: async () => session.userId }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => {
      const filters: Record<string, string> = {};
      const q = {
        select: () => q,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return q;
        },
        // Simulates RLS plus the explicit user_id filter.
        maybeSingle: async () => ({
          data: db.rows.find((r) => r.id === filters.id && r.user_id === filters.user_id) ?? null,
          error: null,
        }),
      };
      return q;
    },
    storage: { from: () => ({ remove: db.remove, download: db.download }) },
  }),
}));

import { GET } from "@/app/api/recipe-thumbnail/[recipeId]/route";
import { deleteRecipeThumbnail, storeRecipeThumbnail } from "@/lib/recipes/thumbnails";
import { STORED_OBJECT_CACHE_CONTROL, setObjectStoreForTesting } from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";

const A = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const B = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const RECIPE = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";
const U = "11111111-2222-4333-8444-555555555555";
const newStem = `${A}/recipes/${U}`;
const legacyStem = `${A}/${U}`;

let store: ReturnType<typeof createFakeObjectStore>;

beforeEach(() => {
  store = createFakeObjectStore();
  setObjectStoreForTesting(store);
  session.userId = A;
  db.rows = [];
  db.remove.mockClear();
  db.download.mockClear();
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.restoreAllMocks();
});

async function png(): Promise<Uint8Array> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 9, g: 9, b: 9 } } })
    .png()
    .toBuffer();
}

describe("storeRecipeThumbnail", () => {
  it("puts both variants under <user>/recipes/ with immutable cache control", async () => {
    const result = await storeRecipeThumbnail(A, await png());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const stem = result.data.path;
    expect(stem).toMatch(new RegExp(`^${A}/recipes/[0-9a-f-]{36}$`));
    expect([...store.objects.keys()].sort()).toEqual([`${stem}_card.webp`, `${stem}_full.webp`]);
    for (const o of store.objects.values()) {
      expect(o.contentType).toBe("image/webp");
      expect(o.cacheControl).toBe(STORED_OBJECT_CACHE_CONTROL);
    }
  });

  it("removes the card variant when the full put fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const realPut = store.put;
    store.put = vi.fn(async (key, bytes, opts) => {
      if (key.endsWith("_full.webp")) throw new Error("boom");
      return realPut(key, bytes, opts);
    });
    const result = await storeRecipeThumbnail(A, await png());
    expect(result).toEqual({ success: false, error: "upload-failed" });
    expect(store.objects.size).toBe(0);
  });

  it("returns upload-failed when the card put fails, and invalid-image for garbage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.put = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(await storeRecipeThumbnail(A, await png())).toEqual({ success: false, error: "upload-failed" });
    expect(await storeRecipeThumbnail(A, Uint8Array.from([1, 2, 3]))).toEqual({
      success: false,
      error: "invalid-image",
    });
  });
});

describe("deleteRecipeThumbnail", () => {
  it("removes both R2 variants of a new stem and never touches Supabase", async () => {
    for (const v of ["card", "full"]) {
      await store.put(`${newStem}_${v}.webp`, new Uint8Array(1), { contentType: "image/webp" });
    }
    await deleteRecipeThumbnail(newStem);
    expect(store.objects.size).toBe(0);
    expect(db.remove).not.toHaveBeenCalled();
  });

  it("sends a legacy stem to the Supabase bucket, not R2", async () => {
    const del = vi.spyOn(store, "delete");
    await deleteRecipeThumbnail(legacyStem);
    expect(db.remove).toHaveBeenCalledWith([`${legacyStem}_card.webp`, `${legacyStem}_full.webp`]);
    expect(del).not.toHaveBeenCalled();
  });

  it("ignores a stem outside the caller's prefix and swallows store errors", async () => {
    const del = vi.spyOn(store, "delete");
    await deleteRecipeThumbnail(`${B}/recipes/${U}`);
    expect(del).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    del.mockRejectedValueOnce(new Error("down"));
    await expect(deleteRecipeThumbnail(newStem)).resolves.toBeUndefined();
  });
});

describe("GET /api/recipe-thumbnail/[recipeId]", () => {
  const call = (size = "card") =>
    GET({ nextUrl: new URL(`http://x/api/recipe-thumbnail/${RECIPE}?size=${size}`) } as never, {
      params: Promise.resolve({ recipeId: RECIPE }),
    });

  it("401 without a session", async () => {
    session.userId = null;
    expect((await call()).status).toBe(401);
  });

  it("404 for another user's recipe, with no redirect or download", async () => {
    db.rows = [{ id: RECIPE, user_id: B, thumbnail_path: `${B}/recipes/${U}` }];
    expect((await call()).status).toBe(404);
    expect(db.download).not.toHaveBeenCalled();
  });

  it("302 to the presigned R2 URL for the owner's new stem", async () => {
    db.rows = [{ id: RECIPE, user_id: A, thumbnail_path: newStem }];
    const res = await call("full");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(await store.presignGet(`${newStem}_full.webp`));
    expect(db.download).not.toHaveBeenCalled();
  });

  it("streams a legacy stem from Supabase with 200", async () => {
    db.rows = [{ id: RECIPE, user_id: A, thumbnail_path: legacyStem }];
    const res = await call();
    expect(res.status).toBe(200);
    expect(db.download).toHaveBeenCalledWith(`${legacyStem}_card.webp`);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  it("404 when the recipe has no thumbnail", async () => {
    db.rows = [{ id: RECIPE, user_id: A, thumbnail_path: null }];
    expect((await call()).status).toBe(404);
  });
});
