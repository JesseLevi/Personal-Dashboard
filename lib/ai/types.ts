import type { z } from "zod";

// Provider-neutral types of the LLM seam (ADR-0018 §4, ADR-0019 §3). Nothing
// here may mention a vendor: a second provider is a new file next to
// anthropic.ts that implements AiProvider, not a change to its callers.

/**
 * `not_configured`: no provider/key, callers degrade. `auth`: key rejected.
 * `rate_limited` / `overloaded` / `unavailable`: provider-side, transient or
 * outage. `invalid_output`: the model answered, but not with our schema
 * (also truncation and refusals).
 */
export type AiErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "overloaded"
  | "unavailable"
  | "invalid_output";

/** Message is safe to log: it never carries prompt or page content. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiError";
  }
}

export type GenerateObjectRequest<S extends z.ZodType> = {
  /** Trusted instructions only. Untrusted text goes in `prompt`, delimited. */
  system: string;
  prompt: string;
  /** Output contract. Cap string/array lengths in it: it is the output bound. */
  schema: S;
  /** Hard cap on generated tokens (default DEFAULT_MAX_OUTPUT_TOKENS). */
  maxOutputTokens?: number;
  /** Short snake_case tag for the usage log, e.g. "recipe_gap_fill". Never content. */
  purpose: string;
};

export interface AiProvider {
  /** Resolves to a value that already passed `schema`; rejects with AiError. */
  generateObject<S extends z.ZodType>(request: GenerateObjectRequest<S>): Promise<z.infer<S>>;
}

/** Includes thinking tokens (Haiku 5.5 thinks adaptively) and the ~30% larger tokenizer. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
