import "server-only";

import type { z } from "zod";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { AiError, type AiProvider, type GenerateObjectRequest } from "@/lib/ai/types";

export { AiError, type AiErrorCode, type AiProvider, type GenerateObjectRequest } from "@/lib/ai/types";

// Provider-neutral entry point (ADR-0019 §3). Callers never import a vendor
// SDK; swapping providers means changing resolveProvider() only.

let testProvider: AiProvider | undefined;
let cached: { key: string; provider: AiProvider } | undefined;

/** Tests inject a fake provider here; `undefined` restores env-based resolution. */
export function setProviderForTests(provider: AiProvider | undefined): void {
  testProvider = provider;
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
