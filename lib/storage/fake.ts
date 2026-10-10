// In-memory ObjectStore for Vitest. Inject via setObjectStoreForTesting.
import "server-only";
import { PRESIGN_EXPIRES_SECONDS, floorToHour, type ObjectStore, type StoredObject } from "./types";

export type FakeObjectStore = ObjectStore & {
  objects: Map<string, StoredObject & { cacheControl?: string }>;
  /** Number of list pages deletePrefix needed on its last call. */
  lastListPages: number;
};

export function createFakeObjectStore(options: { pageSize?: number } = {}): FakeObjectStore {
  const pageSize = options.pageSize ?? 1000;
  const objects: FakeObjectStore["objects"] = new Map();
  const store: FakeObjectStore = {
    objects,
    lastListPages: 0,
    async put(key, bytes, { contentType, cacheControl }) {
      objects.set(key, { bytes: bytes.slice(), contentType, cacheControl });
    },
    async get(key) {
      const o = objects.get(key);
      return o ? { bytes: o.bytes.slice(), contentType: o.contentType } : null;
    },
    async delete(keys) {
      for (const k of keys) objects.delete(k);
    },
    async list(prefix) {
      return [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
    async deletePrefix(prefix) {
      let count = 0;
      store.lastListPages = 0;
      for (;;) {
        const page = [...objects.keys()]
          .filter((k) => k.startsWith(prefix))
          .sort()
          .slice(0, pageSize);
        if (page.length === 0) break;
        store.lastListPages++;
        await store.delete(page);
        count += page.length;
      }
      return count;
    },
    async presignGet(key, now = new Date()) {
      const t = floorToHour(now).toISOString().replace(/[:-]|\.\d{3}/g, "");
      return `https://fake.r2.invalid/${key}?X-Amz-Date=${t}&X-Amz-Expires=${PRESIGN_EXPIRES_SECONDS}`;
    },
  };
  return store;
}
