import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createFakeObjectStore, type FakeObjectStore } from "@/lib/storage/fake";
import {
  isMigratable,
  migrateRow,
  type LegacyRow,
  type LegacySource,
} from "../scripts/backfill-recipe-thumbnails-to-r2-core";

const USER = "11111111-1111-4111-8111-111111111111";
const UUID = "22222222-2222-4222-8222-222222222222";
const OLD = `${USER}/${UUID}`;
const NEW = `${USER}/recipes/${UUID}`;

let store: FakeObjectStore;
let bucket: Map<string, Uint8Array>;
let dbPath: string;
let calls: string[];
let source: LegacySource;
const row = (): LegacyRow => ({ id: "r1", user_id: USER, thumbnail_path: OLD });

beforeEach(() => {
  store = createFakeObjectStore();
  bucket = new Map([
    [`${OLD}_card.webp`, new Uint8Array([1, 2, 3])],
    [`${OLD}_full.webp`, new Uint8Array([4, 5, 6, 7])],
  ]);
  dbPath = OLD;
  calls = [];
  source = {
    download: async (key) => bucket.get(key) ?? null,
    remove: async (keys) => {
      calls.push("remove");
      keys.forEach((k) => bucket.delete(k));
    },
    updateThumbnailPath: async (r, stem) => {
      calls.push("update");
      if (dbPath !== r.thumbnail_path) return false;
      dbPath = stem;
      return true;
    },
  };
});

describe("backfill thumbnails to R2", () => {
  it("dry run writes nothing", async () => {
    const result = await migrateRow(row(), { source, store, apply: false });
    expect(result).toEqual({ status: "would-migrate", bytes: 7 });
    expect(store.objects.size).toBe(0);
    expect(calls).toEqual([]);
    expect(dbPath).toBe(OLD);
    expect(bucket.size).toBe(2);
  });

  it("apply copies, updates the row, then deletes the old objects", async () => {
    const result = await migrateRow(row(), { source, store, apply: true });
    expect(result).toEqual({ status: "migrated", bytes: 7 });
    expect(calls).toEqual(["update", "remove"]);
    expect(dbPath).toBe(NEW);
    const card = store.objects.get(`${NEW}_card.webp`);
    expect(card?.contentType).toBe("image/webp");
    expect(card?.cacheControl).toBe("private, max-age=31536000, immutable");
    expect([...store.objects.get(`${NEW}_full.webp`)!.bytes]).toEqual([4, 5, 6, 7]);
    expect(bucket.size).toBe(0);
  });

  it("a second apply is a no-op", async () => {
    await migrateRow(row(), { source, store, apply: true });
    expect(isMigratable({ thumbnail_path: dbPath })).toBe(false);
    expect(isMigratable({ thumbnail_path: OLD })).toBe(true);
    expect(isMigratable({ thumbnail_path: null })).toBe(false);
  });

  it("a failed R2 put leaves the row and Supabase objects untouched", async () => {
    store.put = async () => {
      throw new Error("R2 down");
    };
    const result = await migrateRow(row(), { source, store, apply: true });
    expect(result.status).toBe("failed");
    expect(calls).toEqual([]);
    expect(dbPath).toBe(OLD);
    expect(bucket.size).toBe(2);
  });

  it("resumes a half-done run whose Supabase objects are already gone", async () => {
    await store.put(`${NEW}_card.webp`, new Uint8Array([1, 2, 3]), { contentType: "image/webp" });
    await store.put(`${NEW}_full.webp`, new Uint8Array([4, 5, 6, 7]), { contentType: "image/webp" });
    bucket.clear();
    const result = await migrateRow(row(), { source, store, apply: true });
    expect(result.status).toBe("migrated");
    expect(dbPath).toBe(NEW);
  });
});
