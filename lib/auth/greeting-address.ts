import { magicLinkSchema } from "./schemas";

/** Pause after the last keystroke before the greeting lookup fires (ADR-0031). */
export const GREETING_LOOKUP_DEBOUNCE_MS = 250;

/**
 * The one normalisation for the greeting lookup and the step-1 submit: trim,
 * then the zod e-mail check. Returns the parsed address, or null when invalid,
 * so " a@b.com " and "a@b.com" are the same address (dedupe in LoginForm).
 */
export function parseGreetingAddress(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : raw;
  const parsed = magicLinkSchema.safeParse({ email: value });
  return parsed.success ? parsed.data.email : null;
}
