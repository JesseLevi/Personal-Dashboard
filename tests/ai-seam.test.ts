import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { generateObject, isAiConfigured, setProviderForTests, type AiProvider } from "@/lib/ai";

const schema = z.object({ ok: z.boolean() });
const request = { system: "s", prompt: "p", schema, purpose: "seam_test" };

afterEach(() => {
  setProviderForTests(undefined);
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
});
