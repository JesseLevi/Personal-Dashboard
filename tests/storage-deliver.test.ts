import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  STORED_OBJECT_CACHE_CONTROL,
  objectKey,
  redirectToStoredObject,
  setObjectStoreForTesting,
} from "@/lib/storage";
import { createFakeObjectStore } from "@/lib/storage/fake";

const A = "0b9f6d3e-7d5a-4c1e-9a52-3f6f2f1c8a11";
const B = "7c1d0a52-1b3e-4f0a-8c44-9d2e5b6a7f10";
const keyA = objectKey(A, "recipes", "r1", "thumb.webp");

let store: ReturnType<typeof createFakeObjectStore>;
let presign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = createFakeObjectStore();
  presign = vi.fn(store.presignGet);
  store.presignGet = presign as typeof store.presignGet;
  setObjectStoreForTesting(store);
});
afterEach(() => {
  setObjectStoreForTesting(null);
  vi.restoreAllMocks();
});

describe("redirectToStoredObject", () => {
  it("401 without a session, ownerCheck not run", async () => {
    const ownerCheck = vi.fn();
    const res = await redirectToStoredObject({ userId: null, ownerCheck });
    expect(res.status).toBe(401);
    expect(ownerCheck).not.toHaveBeenCalled();
  });

  it("404 when ownerCheck finds no row", async () => {
    const res = await redirectToStoredObject({ userId: A, ownerCheck: async () => null });
    expect(res.status).toBe(404);
    expect(presign).not.toHaveBeenCalled();
  });

  it("404 when the key belongs to another user", async () => {
    const res = await redirectToStoredObject({ userId: B, ownerCheck: async () => keyA });
    expect(res.status).toBe(404);
    expect(presign).not.toHaveBeenCalled();
  });

  it("404 (and logs) when ownerCheck throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await redirectToStoredObject({
      userId: A,
      ownerCheck: async () => {
        throw new Error("db down");
      },
    });
    expect(res.status).toBe(404);
    expect(log).toHaveBeenCalled();
    expect(presign).not.toHaveBeenCalled();
  });

  it("302 to the presigned URL with cache and referrer headers for the owner", async () => {
    const res = await redirectToStoredObject({ userId: A, ownerCheck: async () => keyA });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(await store.presignGet(keyA));
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=1800");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("exports the immutable put-side cache control", () => {
    expect(STORED_OBJECT_CACHE_CONTROL).toBe("private, max-age=31536000, immutable");
  });
});

// Replaces the storage.objects RLS test (ADR-0024 §3): ownership is the
// RLS-bound row lookup plus the key prefix check.
describe("ADR-0024 §3: user B cannot get a redirect for user A's object", () => {
  const rows = [
    { id: "r-a", user_id: A, thumbnail_path: keyA },
    { id: "r-b", user_id: B, thumbnail_path: objectKey(B, "recipes", "r2", "thumb.webp") },
  ];
  // Simulates the RLS-bound client: only the caller's own rows are visible.
  const lookup = (id: string) => async (uid: string) =>
    rows.find((r) => r.id === id && r.user_id === uid)?.thumbnail_path ?? null;

  it("B asking for A's row gets 404 and no presign", async () => {
    const res = await redirectToStoredObject({ userId: B, ownerCheck: lookup("r-a") });
    expect(res.status).toBe(404);
    expect(presign).not.toHaveBeenCalled();
  });

  it("A gets 302 for the same row", async () => {
    const res = await redirectToStoredObject({ userId: A, ownerCheck: lookup("r-a") });
    expect(res.status).toBe(302);
    expect(presign).toHaveBeenCalledWith(keyA);
  });
});
