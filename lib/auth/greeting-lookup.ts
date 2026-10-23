import "server-only";
import { z } from "zod";
import { magicLinkSchema } from "@/lib/auth/schemas";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { getRequestContext, verifyTurnstile } from "@/lib/auth/turnstile";

// ADR-0031: login greeting name lookup. Fail closed on every problem and
// return the same `{ name: null }` shape. Never log email, name, IP or token.

const MIN_SALT_LENGTH = 16;
const MIN_DURATION_MS = 500;
const inputSchema = z.object({
  email: magicLinkSchema.shape.email.max(254),
  turnstileToken: z.string().min(1).max(2048).nullable(),
});

export type GreetingResult = { name: string | null };

async function lookup(input: unknown): Promise<GreetingResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || parsed.data.turnstileToken === null) {
    return { name: null };
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const salt = process.env.LOGIN_GREETING_SALT;
  if (!secret || !salt || salt.length < MIN_SALT_LENGTH) return { name: null };

  const { ip, host, clientKey } = await getRequestContext();
  const ok = await verifyTurnstile(secret, parsed.data.turnstileToken, ip, host);
  if (!ok) return { name: null };

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.rpc("login_greeting_name", {
    p_email: parsed.data.email,
    p_client_key: clientKey,
  });
  if (error || typeof data !== "string" || data === "") return { name: null };
  return { name: data };
}

export async function lookupGreetingName(input: {
  email: string;
  turnstileToken: string | null;
}): Promise<GreetingResult> {
  const start = Date.now();
  let result: GreetingResult;
  try {
    result = await lookup(input);
  } catch {
    result = { name: null };
  }
  const remaining = MIN_DURATION_MS - (Date.now() - start);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  return result;
}
