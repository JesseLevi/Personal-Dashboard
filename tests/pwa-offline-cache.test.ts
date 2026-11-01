import { afterEach, describe, expect, it, vi } from "vitest";
import { clearOfflineCache, OFFLINE_PAGES_CACHE } from "@/lib/pwa/offline-cache";

afterEach(() => vi.unstubAllGlobals());

describe("clearOfflineCache", () => {
  it("drops cached basket pages and keeps the offline page", async () => {
    const deleted: string[] = [];
    const cache = {
      keys: async () => [
        { url: "https://atlas.test/offline" },
        { url: "https://atlas.test/winkelmand/3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f" },
      ],
      delete: async (key: { url: string }) => {
        deleted.push(new URL(key.url).pathname);
        return true;
      },
    };
    const open = vi.fn(async () => cache);
    const postMessage = vi.fn();
    vi.stubGlobal("window", { caches: {} });
    vi.stubGlobal("caches", { open });
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } });

    await clearOfflineCache();

    expect(postMessage).toHaveBeenCalledWith("atlas:clear");
    expect(open).toHaveBeenCalledWith(OFFLINE_PAGES_CACHE);
    expect(deleted).toEqual(["/winkelmand/3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f"]);
  });

  it("never throws, so logout always proceeds", async () => {
    vi.stubGlobal("window", { caches: {} });
    vi.stubGlobal("caches", { open: async () => Promise.reject(new Error("blocked")) });
    vi.stubGlobal("navigator", {});
    await expect(clearOfflineCache()).resolves.toBeUndefined();
  });
});
