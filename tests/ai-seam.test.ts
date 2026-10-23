import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  EMBEDDING_DIMENSIONS,
  embed,
  generateObject,
  isAiConfigured,
  isEmbeddingConfigured,
  setEmbeddingProviderForTests,
  setProviderForTests,
  type AiProvider,
} from "@/lib/ai";

const schema = z.object({ ok: z.boolean() });
const request = { system: "s", prompt: "p", schema, purpose: "seam_test" };

afterEach(() => {
  setProviderForTests(undefined);
  setEmbeddingProviderForTests(undefined);
  vi.unstubAllEnvs();
});

describe("generateObject", () => {
  it("rejects with not_configured when no key and no provider", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
    await expect(generateObject(request)).rejects.toMatchObject({ code: "not_configured" });
  });

  it("uses an injected provider and re-validates what it returns", async () => {
    const provider: AiProvider = { generateObject: vi.fn().mockResolvedValue({ ok: "yes" }) };
    setProviderForTests(provider);
    expect(isAiConfigured()).toBe(true);
    await expect(generateObject(request)).rejects.toMatchObject({ code: "invalid_output" });
    provider.generateObject = vi.fn().mockResolvedValue({ ok: true });
    await expect(generateObject(request)).resolves.toEqual({ ok: true });
  });
});

describe("embed", () => {
  it("rejects with not_configured without Cloudflare credentials", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "");
    expect(isEmbeddingConfigured()).toBe(false);
    await expect(embed({ texts: ["a"], purpose: "seam_test" })).rejects.toMatchObject({ code: "not_configured" });
  });

  it("is configured with both variables set", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "tok");
    expect(isEmbeddingConfigured()).toBe(true);
  });

  it("re-checks count and dimension of an injected provider", async () => {
    const good = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    setEmbeddingProviderForTests({ embed: vi.fn().mockResolvedValue([good.slice(1)]) });
    await expect(embed({ texts: ["a"], purpose: "seam_test" })).rejects.toMatchObject({ code: "invalid_output" });
    setEmbeddingProviderForTests({ embed: vi.fn().mockResolvedValue([good]) });
    await expect(embed({ texts: ["a", "b"], purpose: "seam_test" })).rejects.toMatchObject({ code: "invalid_output" });
    await expect(embed({ texts: ["a"], purpose: "seam_test" })).resolves.toEqual([good]);
  });

  it("returns an empty list for no texts without calling the provider", async () => {
    const provider = { embed: vi.fn() };
    setEmbeddingProviderForTests(provider);
    await expect(embed({ texts: [], purpose: "seam_test" })).resolves.toEqual([]);
    expect(provider.embed).not.toHaveBeenCalled();
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) return [];
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

describe("provider swappability", () => {
  it("only lib/ai/anthropic.ts imports the Anthropic SDK", () => {
    const root = path.resolve(__dirname, "..");
    const sdk = /from\s+["']@anthropic-ai\/|require\(["']@anthropic-ai\/|import\(["']@anthropic-ai\//;
    const offenders = ["lib", "app", "components", "worker", "scripts"]
      .flatMap((dir) => sourceFiles(path.join(root, dir)))
      .filter((file) => sdk.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual(["lib/ai/anthropic.ts"]);
  });

  it("only lib/ai/cloudflare.ts knows the Workers AI endpoint and CLOUDFLARE_* env", () => {
    const root = path.resolve(__dirname, "..");
    const known = /api\.cloudflare\.com|CLOUDFLARE_[A-Z]/;
    const offenders = ["lib", "app", "components", "worker"]
      .flatMap((dir) => sourceFiles(path.join(root, dir)))
      .filter((file) => known.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual(["lib/ai/cloudflare.ts"]);
  });
});
