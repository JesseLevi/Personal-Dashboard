import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import {
  AiError,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type AiProvider,
  type GenerateObjectRequest,
} from "@/lib/ai/types";

// The ONLY file that imports @anthropic-ai/sdk (tests/ai-seam.test.ts greps
// for it). Structured output via output_config.format, no tools, nothing
// else enabled. Docs: the claude-api skill (typescript README, structured
// outputs) and the SDK's typed exceptions.

/** Claude Haiku 4.5, the alias from ADR-0019 §3 (not a dated snapshot id). */
export const ANTHROPIC_MODEL = "claude-haiku-4-5";

// ADR-0019 §1: the pipeline runs inside after(), so no long waits or retry
// loops. One retry covers a transient 429/5xx, 30 s bounds a hung socket.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

type MessagesClient = Pick<Anthropic, "messages">;

/** Status 529 is the API's "overloaded"; the SDK has no class for it. */
const OVERLOADED_STATUS = 529;

export function mapAnthropicError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    const message = `Anthropic request failed (status ${status ?? "none"})`;
    if (error instanceof Anthropic.RateLimitError) return new AiError("rate_limited", message, { cause: error });
    if (status === OVERLOADED_STATUS) return new AiError("overloaded", message, { cause: error });
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return new AiError("auth", message, { cause: error });
    }
    // Connection errors, timeouts, 5xx and unexpected 4xx: nothing the caller can fix.
    return new AiError("unavailable", message, { cause: error });
  }
  return new AiError("unavailable", "Anthropic request failed", { cause: error });
}

export function createAnthropicProvider(options: {
  apiKey?: string;
  /** Test seam: a stand-in for the SDK client. */
  client?: MessagesClient;
}): AiProvider {
  const client: MessagesClient =
    options.client ??
    new Anthropic({ apiKey: options.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });

  return {
    async generateObject<S extends z.ZodType>(request: GenerateObjectRequest<S>): Promise<z.infer<S>> {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          temperature: 0,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
          output_config: { format: zodOutputFormat(request.schema) },
        });
      } catch (error) {
        throw mapAnthropicError(error);
      }

      // Cost tracking (ADR-0018 §3): counts and tags only, never content.
      console.info(
        JSON.stringify({
          event: "ai_usage",
          provider: "anthropic",
          model: ANTHROPIC_MODEL,
          purpose: request.purpose,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }),
      );

      if (response.stop_reason === "max_tokens") {
        throw new AiError("invalid_output", "Model output was truncated at maxOutputTokens");
      }
      if (response.stop_reason === "refusal") {
        throw new AiError("invalid_output", "Model refused the request");
      }
      const block = response.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") {
        throw new AiError("invalid_output", "Model returned no text content");
      }
      let json: unknown;
      try {
        json = JSON.parse(block.text);
      } catch {
        throw new AiError("invalid_output", "Model output is not valid JSON");
      }
      const parsed = request.schema.safeParse(json);
      if (!parsed.success) {
        // Issue paths only: messages can quote the offending value.
        const paths = parsed.error.issues.map((i) => i.path.join(".") || "(root)").join(", ");
        throw new AiError("invalid_output", `Model output failed schema validation at: ${paths}`);
      }
      return parsed.data;
    },
  };
}
