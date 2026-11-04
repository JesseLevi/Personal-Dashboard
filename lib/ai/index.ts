import "server-only";

import type { z } from "zod";
import { ANTHROPIC_MODEL, createAnthropicProvider } from "@/lib/ai/anthropic";
import { createCloudflareEmbeddingProviderFromEnv } from "@/lib/ai/cloudflare";
import {
  AiError,
  EMBEDDING_DIMENSIONS,
  type AiProvider,
  type EmbedRequest,
  type EmbeddingProvider,
  type GenerateObjectRequest,
  type GenerateObjectResult,
} from "@/lib/ai/types";

export {
  AiError,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type AiErrorCode,
  type AiProvider,
  type AiUsage,
  type EmbedRequest,
  type EmbeddingProvider,
  type GenerateObjectRequest,
  type GenerateObjectResult,
} from "@/lib/ai/types";

/** Id of the model the seam talks to, for run logs. Never a secret. */
export const AI_MODEL: string = ANTHROPIC_MODEL;

// Provider-neutral entry point (ADR-0019 §3). Callers never import a vendor
// SDK; swapping providers means changing resolveProvider() only.

let testProvider: AiProvider | undefined;
let testEmbeddingProvider: EmbeddingProvider | undefined;
let cached: { key: string; provider: AiProvider } | undefined;

/** Tests inject a fake provider here; `undefined` restores env-based resolution. */
export function setProviderForTests(provider: AiProvider | undefined): void {
  testProvider = provider;
}

/** Tests inject a fake embedding provider here; `undefined` restores env-based resolution. */
export function setEmbeddingProviderForTests(provider: EmbeddingProvider | undefined): void {
  testEmbeddingProvider = provider;
}

function resolveProvider(): AiProvider | null {
  if (testProvider) return testProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  if (cached?.key !== apiKey) cached = { key: apiKey, provider: createAnthropicProvider({ apiKey }) };
  return cached.provider;
}

/** False when no provider is configured: callers skip the LLM and degrade (ADR-0019 §6). */
export function isAiConfigured(): boolean {
  return resolveProvider() !== null;
}

/**
 * Prompt + zod schema in, validated object out. Rejects with AiError only.
 * The schema is re-checked here so no provider can hand back unvalidated data.
 */
export async function generateObject<S extends z.ZodType>(request: GenerateObjectRequest<S>): Promise<z.infer<S>> {
  const provider = resolveProvider();
  if (!provider) throw new AiError("not_configured", "No AI provider configured (ANTHROPIC_API_KEY unset)");
  const result = await provider.generateObject(request);
  const checked = request.schema.safeParse(result);
  if (!checked.success) throw new AiError("invalid_output", "Provider returned data that fails the schema");
  return checked.data;
}

/**
 * Same as generateObject, plus the provider's token counts. A provider without
 * usage reporting yields zeros. Existing callers keep using generateObject.
 */
export async function generateObjectWithUsage<S extends z.ZodType>(
  request: GenerateObjectRequest<S>,
): Promise<GenerateObjectResult<S>> {
  const provider = resolveProvider();
  if (!provider) throw new AiError("not_configured", "No AI provider configured (ANTHROPIC_API_KEY unset)");
  const result = provider.generateObjectWithUsage
    ? await provider.generateObjectWithUsage(request)
    : { object: await provider.generateObject(request), usage: { inputTokens: 0, outputTokens: 0 } };
  const checked = request.schema.safeParse(result.object);
  if (!checked.success) throw new AiError("invalid_output", "Provider returned data that fails the schema");
  return { object: checked.data, usage: result.usage };
}

function resolveEmbeddingProvider(): EmbeddingProvider | null {
  return testEmbeddingProvider ?? createCloudflareEmbeddingProviderFromEnv();
}

/** False without Cloudflare credentials: callers fall back to keyword search (ADR-0043 §2). */
export function isEmbeddingConfigured(): boolean {
  return resolveEmbeddingProvider() !== null;
}

/**
 * Texts in, one 1024-d vector per text out, same order. Rejects with AiError
 * only. The shape is re-checked here so no provider can hand back bad vectors.
 */
export async function embed(request: EmbedRequest): Promise<number[][]> {
  const provider = resolveEmbeddingProvider();
  if (!provider) {
    throw new AiError("not_configured", "No embedding provider configured (Cloudflare credentials unset)");
  }
  if (request.texts.length === 0) return [];
  const vectors = await provider.embed(request);
  const ok =
    vectors.length === request.texts.length && vectors.every((v) => v.length === EMBEDDING_DIMENSIONS);
  if (!ok) throw new AiError("invalid_output", "Provider returned vectors of the wrong count or dimension");
  return vectors;
}
