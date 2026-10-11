import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { ANTHROPIC_MODEL, createAnthropicProvider, mapAnthropicError } from "@/lib/ai/anthropic";
import { AiError } from "@/lib/ai/types";
import { LinkSchema, PrepareSchema, TextRecipeSchema } from "@/lib/recipes/import/ai-fill";

const schema = z.object({ name: z.string().max(10), n: z.number().int() });
const request = { system: "sys", prompt: "p", schema, purpose: "unit_test" };

function providerReturning(message: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue({
    stop_reason: "end_turn",
    usage: { input_tokens: 11, output_tokens: 7 },
    content: [{ type: "text", text: "{}" }],
    ...message,
  });
  return { create, provider: createAnthropicProvider({ client: { messages: { create } } as never }) };
}

afterEach(() => vi.restoreAllMocks());

describe("createAnthropicProvider", () => {
  it("sends model, schema format and no tools; returns the validated object and logs usage", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { create, provider } = providerReturning({ content: [{ type: "text", text: '{"name":"ui","n":2}' }] });
    await expect(provider.generateObject(request)).resolves.toEqual({ name: "ui", n: 2 });
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.tools).toBeUndefined();
    // Haiku 5.5 answers a non-default sampling parameter with a 400.
    for (const key of ["temperature", "top_p", "top_k"]) expect(params).not.toHaveProperty(key);
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(JSON.parse(info.mock.calls[0]![0] as string)).toEqual({
      event: "ai_usage",
      provider: "anthropic",
      model: ANTHROPIC_MODEL,
      purpose: "unit_test",
      inputTokens: 11,
      outputTokens: 7,
    });
  });

  it.each([
    ["schema-invalid", { content: [{ type: "text", text: '{"name":"far too long for the cap","n":1}' }] }],
    ["wrong type", { content: [{ type: "text", text: '{"name":"a","n":"x"}' }] }],
    ["not json", { content: [{ type: "text", text: "sure! here you go" }] }],
    ["no text block", { content: [] }],
    ["truncated", { stop_reason: "max_tokens", content: [{ type: "text", text: '{"name":' }] }],
    ["refusal", { stop_reason: "refusal", content: [] }],
  ])("rejects %s output as invalid_output", async (_label, message) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { provider } = providerReturning(message);
    await expect(provider.generateObject(request)).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("never puts model output in the error message", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { provider } = providerReturning({ content: [{ type: "text", text: '{"name":"SECRET-PAGE-TEXT-LONG","n":1}' }] });
    const error = await provider.generateObject(request).catch((e: unknown) => e);
    expect((error as Error).message).not.toContain("SECRET");
  });

  it("maps a thrown SDK error through mapAnthropicError", async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()));
    const provider = createAnthropicProvider({ client: { messages: { create } } as never });
    await expect(provider.generateObject(request)).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("mapAnthropicError", () => {
  const h = new Headers();
  it.each([
    ["RateLimitError 429", new Anthropic.RateLimitError(429, undefined, "m", h), "rate_limited"],
    ["overloaded 529", new Anthropic.InternalServerError(529, undefined, "m", h), "overloaded"],
    ["AuthenticationError 401", new Anthropic.AuthenticationError(401, undefined, "m", h), "auth"],
    ["PermissionDeniedError 403", new Anthropic.PermissionDeniedError(403, undefined, "m", h), "auth"],
    ["InternalServerError 500", new Anthropic.InternalServerError(500, undefined, "m", h), "unavailable"],
    ["BadRequestError 400", new Anthropic.BadRequestError(400, undefined, "m", h), "unavailable"],
    ["APIConnectionError", new Anthropic.APIConnectionError({ message: "down" }), "unavailable"],
    ["APIConnectionTimeoutError", new Anthropic.APIConnectionTimeoutError(), "unavailable"],
    ["plain Error", new Error("boom"), "unavailable"],
  ])("%s -> %s", (_label, error, code) => {
    const mapped = mapAnthropicError(error);
    expect(mapped).toBeInstanceOf(AiError);
    expect(mapped.code).toBe(code);
  });
});

describe("import schemas", () => {
  it("convert to a structured-output JSON schema", () => {
    for (const s of [PrepareSchema, LinkSchema, TextRecipeSchema]) {
      expect(zodOutputFormat(s).type).toBe("json_schema");
    }
  });
});
