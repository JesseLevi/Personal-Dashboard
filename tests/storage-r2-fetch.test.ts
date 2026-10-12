import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createR2Store } from "@/lib/storage/r2";

const store = createR2Store({
  accountId: "acct",
  accessKeyId: "AKIAFAKE",
  secretAccessKey: "fake-secret",
  bucket: "bkt",
});

afterEach(() => vi.unstubAllGlobals());

describe("R2 request transport (#446)", () => {
  it("put() sends a URL string, the raw bytes and signed headers, never a Request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await store.put("u/recipes/a/thumb.webp", bytes, { contentType: "image/webp" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit];
    expect(typeof input).toBe("string");
    expect(input).toBe("https://acct.r2.cloudflarestorage.com/bkt/u/recipes/a/thumb.webp");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect((init.body as Uint8Array).byteLength).toBe(5);
    expect(init.cache).toBe("no-store");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(headers.get("x-amz-content-sha256")).toBeTruthy();
    expect(headers.get("content-type")).toBe("image/webp");
  });

  it("retries on 503 and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await store.put("u/recipes/a/thumb.webp", new Uint8Array([1]), { contentType: "image/webp" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry budget and throws", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      store.put("u/recipes/a/thumb.webp", new Uint8Array([1]), { contentType: "image/webp" }),
    ).rejects.toThrow(/PUT 503/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
