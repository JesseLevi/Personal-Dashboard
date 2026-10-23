import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_BATCH_TEXTS,
  MAX_TEXT_CHARS,
  createCloudflareEmbeddingProvider,
  mapCloudflareStatus,
} from "@/lib/ai/cloudflare";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/types";

const vec = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed);
const ok = (data: number[][]) =>
  new Response(JSON.stringify({ success: true, errors: [], result: { data, shape: [data.length, EMBEDDING_DIMENSIONS] } }));

/** Answers every batch with vectors whose value is the text's number, so order is checkable. */
const echoFetch = () =>
  vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { text } = JSON.parse(String(init?.body)) as { text: string[] };
    return ok(text.map((t) => vec(Number(t))));
  });

const make = (fetchFn: typeof fetch) =>
  createCloudflareEmbeddingProvider({ accountId: "acc", apiToken: "tok", fetch: fetchFn });
const req = (texts: string[]) => ({ texts, purpose: "test" });

afterEach(() => vi.restoreAllMocks());

describe("cloudflare embed", () => {
  it("posts to the bge-m3 endpoint with a bearer token", async () => {
    const f = echoFetch();
    await make(f as unknown as typeof fetch).embed(req(["1"]));
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/baai/bge-m3");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("splits into batches and keeps the order", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const f = echoFetch();
    const texts = Array.from({ length: MAX_BATCH_TEXTS * 2 + 1 }, (_, i) => String(i + 1));
    const out = await make(f as unknown as typeof fetch).embed(req(texts));
    expect(f).toHaveBeenCalledTimes(3);
    expect(out.map((v) => v[0])).toEqual(texts.map(Number));
  });

  it("logs counts only, never content", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await make(echoFetch() as unknown as typeof fetch).embed(req(["42"]));
    const line = String(info.mock.calls[0]![0]);
    expect(JSON.parse(line)).toMatchObject({ event: "ai_usage", provider: "cloudflare", texts: 1 });
    expect(line).not.toContain("42\"");
  });

  it("rejects empty and oversized texts", async () => {
    const p = make(vi.fn() as unknown as typeof fetch);
    await expect(p.embed(req([" "]))).rejects.toMatchObject({ code: "invalid_output" });
    await expect(p.embed(req(["x".repeat(MAX_TEXT_CHARS + 1)]))).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("rejects wrong dimensions, wrong count and a malformed body", async () => {
    const bad = async (res: Response) =>
      make(vi.fn().mockResolvedValue(res) as unknown as typeof fetch).embed(req(["a"]));
    await expect(bad(ok([[1, 2, 3]]))).rejects.toMatchObject({ code: "invalid_output" });
    await expect(bad(ok([vec(1), vec(1)]))).rejects.toMatchObject({ code: "invalid_output" });
    await expect(bad(new Response(JSON.stringify({ nope: 1 })))).rejects.toMatchObject({ code: "invalid_output" });
    await expect(bad(new Response("<html>"))).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("maps statuses onto AiError codes", () => {
    expect(mapCloudflareStatus(429).code).toBe("rate_limited");
    expect(mapCloudflareStatus(401).code).toBe("auth");
    expect(mapCloudflareStatus(403).code).toBe("auth");
    expect(mapCloudflareStatus(500).code).toBe("unavailable");
    expect(mapCloudflareStatus(400).code).toBe("unavailable");
  });

  it("does not retry auth errors", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(make(f as unknown as typeof fetch).embed(req(["a"]))).rejects.toMatchObject({ code: "auth" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure once, then gives up", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(ok([vec(1)]));
    await expect(make(f as unknown as typeof fetch).embed(req(["a"]))).resolves.toHaveLength(1);
    const g = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(make(g as unknown as typeof fetch).embed(req(["a"]))).rejects.toMatchObject({ code: "rate_limited" });
    expect(g).toHaveBeenCalledTimes(2);
  });

  it("maps a network failure to unavailable", async () => {
    const f = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(make(f as unknown as typeof fetch).embed(req(["a"]))).rejects.toMatchObject({ code: "unavailable" });
  });
});
