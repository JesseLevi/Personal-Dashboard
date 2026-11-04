import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Runs public/sw.js against an in-memory Cache API to test the ADR-0054 caching rules.
const ORIGIN = "https://atlas.test";
const BASKET = "/winkelmand/3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";
const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

type Listener = (event: Record<string, unknown>) => void;
type FakeResponse = { ok: boolean; type: string; redirected: boolean; body: string; clone: () => FakeResponse };

function res(body: string, init: Partial<FakeResponse> = {}): FakeResponse {
  const r: FakeResponse = { ok: true, type: "basic", redirected: false, body, clone: () => ({ ...r }), ...init };
  return r;
}

function setup(fetchImpl: (url: string) => Promise<FakeResponse>) {
  const stores = new Map<string, Map<string, FakeResponse>>();
  const listeners: Record<string, Listener> = {};
  const keyOf = (r: unknown) => new URL(typeof r === "string" ? r : (r as { url: string }).url, ORIGIN).href;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name)!;
      return {
        put: async (k: unknown, v: FakeResponse) => void m.set(keyOf(k), v),
        match: async (k: unknown) => m.get(keyOf(k)),
        keys: async () => [...m.keys()].map((url) => ({ url })),
        delete: async (k: { url: string }) => m.delete(k.url),
        add: async () => undefined,
      };
    },
    keys: async () => [...stores.keys()],
    delete: async () => true,
  };
  const sandbox: Record<string, unknown> = {
    URL,
    Request: class {},
    Response: { error: () => "network-error" },
    caches,
    fetch: (u: string) => fetchImpl(u),
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
  };
  vm.runInNewContext(source, sandbox);
  const pages = () => {
    if (!stores.has("atlas-pages-v1")) stores.set("atlas-pages-v1", new Map());
    return stores.get("atlas-pages-v1")!;
  };
  const message = async (data: unknown) => {
    const waits: Promise<unknown>[] = [];
    listeners.message({ data, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  const navigate = async (path: string) => {
    let out: Promise<unknown> | undefined;
    listeners.fetch({
      request: { method: "GET", mode: "navigate", url: ORIGIN + path },
      respondWith: (p: Promise<unknown>) => (out = p),
    });
    return out as Promise<FakeResponse | string>;
  };
  return { pages, message, navigate };
}

const online = async () => res("<html>basket</html>");
const offline = async () => Promise.reject(new Error("offline"));

describe("service worker basket caching", () => {
  it("stores a basket page on request, plus the last-basket copy", async () => {
    const sw = setup(online);
    await sw.message({ type: "atlas:cache-basket", path: BASKET });
    expect([...sw.pages().keys()].sort()).toEqual([ORIGIN + "/__last-basket", ORIGIN + BASKET].sort());
  });

  it("ignores every path that is not a basket page", async () => {
    const sw = setup(online);
    for (const path of ["/winkelmand", "/api/shopping", "/auth/callback", "/vandaag", "/__last-basket", "https://evil.test" + BASKET]) {
      await sw.message({ type: "atlas:cache-basket", path });
    }
    expect(sw.pages().size).toBe(0);
  });

  it("does not store redirected, non-ok or non-basic responses", async () => {
    for (const bad of [{ redirected: true }, { ok: false }, { type: "opaque" }]) {
      const sw = setup(async () => res("x", bad));
      await sw.message({ type: "atlas:cache-basket", path: BASKET });
      expect(sw.pages().size).toBe(0);
    }
  });

  it("does not throw or store when offline", async () => {
    const sw = setup(offline);
    await sw.message({ type: "atlas:cache-basket", path: BASKET });
    expect(sw.pages().size).toBe(0);
  });

  it("serves the last basket for /winkelmand offline, /offline when none", async () => {
    let up = true;
    const sw = setup(async (u) => (up ? res("basket:" + u) : Promise.reject(new Error("offline"))));
    sw.pages().set(ORIGIN + "/offline", res("offline-page"));
    up = true;
    await sw.message({ type: "atlas:cache-basket", path: BASKET });
    up = false;
    expect(((await sw.navigate("/winkelmand")) as FakeResponse).body).toBe("basket:" + ORIGIN + BASKET);
    expect(((await sw.navigate("/vandaag")) as FakeResponse).body).toBe("offline-page");
  });

  it("falls back to /offline on /winkelmand without a stored basket", async () => {
    const sw = setup(offline);
    sw.pages().set(ORIGIN + "/offline", res("offline-page"));
    expect(((await sw.navigate("/winkelmand")) as FakeResponse).body).toBe("offline-page");
  });

  it("wipes baskets and the last-basket copy on atlas:clear, keeping /offline", async () => {
    const sw = setup(online);
    sw.pages().set(ORIGIN + "/offline", res("offline-page"));
    await sw.message({ type: "atlas:cache-basket", path: BASKET });
    await sw.message("atlas:clear");
    expect([...sw.pages().keys()]).toEqual([ORIGIN + "/offline"]);
  });
});
