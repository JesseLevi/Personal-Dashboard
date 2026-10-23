import "server-only";

import { z } from "zod";
import {
  AiError,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type EmbedRequest,
  type EmbeddingProvider,
} from "@/lib/ai/types";

// The ONLY file that knows the Workers AI endpoint and the CLOUDFLARE_* env
// names (tests/ai-seam.test.ts greps for them). Docs: Workers AI REST
// `POST /accounts/{id}/ai/run/{model}`, body `{ text: string | string[] }`,
// answer `{ success, errors, result: { data: number[][], shape } }`.

/**
 * Cloudflare documents no maximum batch size for bge-m3 (model page, API
 * reference); 32 texts per call is our own conservative cap.
 */
export const MAX_BATCH_TEXTS = 32;

/**
 * The bge-m3 context window is 60,000 tokens (model page); Cloudflare gives no
 * per-input limit. 20,000 characters stays far below it, even at one token per
 * character. Longer inputs are rejected, never truncated: chunking is the
 * caller's job (ADR-0043 §8).
 */
export const MAX_TEXT_CHARS = 20_000;

// Same budget as anthropic.ts: the pipeline runs inside after() (ADR-0019 §1).
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

const responseSchema = z.object({
  success: z.boolean(),
  result: z.object({ data: z.array(z.array(z.number())) }),
});

export function mapCloudflareStatus(status: number): AiError {
  const message = `Cloudflare Workers AI request failed (status ${status})`;
  if (status === 429) return new AiError("rate_limited", message);
  if (status === 401 || status === 403) return new AiError("auth", message);
  return new AiError("unavailable", message);
}

function isTransient(error: AiError): boolean {
  return error.code === "unavailable" || error.code === "rate_limited";
}

export function createCloudflareEmbeddingProvider(options: {
  accountId: string;
  apiToken: string;
  /** Test seam: a stand-in for global fetch. */
  fetch?: typeof fetch;
}): EmbeddingProvider {
  const doFetch = options.fetch ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${EMBEDDING_MODEL}`;

  async function attempt(batch: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: batch }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AiError("unavailable", "Cloudflare Workers AI request failed", { cause: error });
    }
    if (!response.ok) throw mapCloudflareStatus(response.status);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AiError("invalid_output", "Cloudflare Workers AI answer is not valid JSON");
    }
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success || !parsed.data.success) {
      throw new AiError("invalid_output", "Cloudflare Workers AI answer has an unexpected shape");
    }
    const { data } = parsed.data.result;
    if (data.length !== batch.length || data.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new AiError("invalid_output", "Cloudflare Workers AI returned the wrong number or size of vectors");
    }
    // The embeddings endpoint reports no token usage, so the log carries counts only.
    return data;
  }

  async function runBatch(batch: string[]): Promise<number[][]> {
    for (let retry = 0; ; retry++) {
      try {
        return await attempt(batch);
      } catch (error) {
        if (!(error instanceof AiError) || !isTransient(error) || retry >= MAX_RETRIES) throw error;
      }
    }
  }

  return {
    async embed(request: EmbedRequest): Promise<number[][]> {
      if (request.texts.some((t) => t.trim() === "" || t.length > MAX_TEXT_CHARS)) {
        throw new AiError("invalid_output", `Texts must be non-empty and at most ${MAX_TEXT_CHARS} characters`);
      }
      const vectors: number[][] = [];
      for (let i = 0; i < request.texts.length; i += MAX_BATCH_TEXTS) {
        vectors.push(...(await runBatch(request.texts.slice(i, i + MAX_BATCH_TEXTS))));
      }
      // Cost tracking (ADR-0018 §3): counts and tags only, never content.
      console.info(
        JSON.stringify({
          event: "ai_usage",
          provider: "cloudflare",
          model: EMBEDDING_MODEL,
          purpose: request.purpose,
          texts: request.texts.length,
          calls: Math.ceil(request.texts.length / MAX_BATCH_TEXTS),
          tokens: null,
        }),
      );
      return vectors;
    },
  };
}

let cached: { key: string; provider: EmbeddingProvider } | undefined;

/** Null unless both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN are set. */
export function createCloudflareEmbeddingProviderFromEnv(): EmbeddingProvider | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;
  const key = `${accountId}:${apiToken}`;
  if (cached?.key !== key) cached = { key, provider: createCloudflareEmbeddingProvider({ accountId, apiToken }) };
  return cached.provider;
}
