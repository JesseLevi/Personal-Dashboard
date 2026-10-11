import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { magicLinkSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ADR-0031: login greeting name lookup. Fail closed on every problem and
// return the same `{ name: null }` shape. Never log email, name, IP or token.

const MIN_DURATION_MS = 500;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const EXPECTED_ACTION = "login_greeting";
// Cloudflare's documented always-pass secret. Its Siteverify reply does not
// carry our action or hostname (dummy values), so those two checks are skipped
// for this secret only; success is still required.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

const inputSchema = z.object({
  email: magicLinkSchema.shape.email,
  turnstileToken: z.string().min(1).max(2048).nullable(),
});

export type GreetingResult = { name: string | null };

const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string,
  host: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    if (body.success !== true) return false;
    if (secret === TURNSTILE_TEST_SECRET) return true;
    return body.action === EXPECTED_ACTION && !!host && body.hostname === host;
  } catch {
    return false;
  }
}

async function lookup(input: unknown): Promise<GreetingResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || parsed.data.turnstileToken === null) {
    return { name: null };
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const salt = process.env.LOGIN_GREETING_SALT;
  if (!secret || !salt) return { name: null };

  const h = await headers();
  // Vercel sets x-real-ip itself; x-forwarded-for is only a fallback.
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim() ?? null;

  const ok = await verifyTurnstile(secret, parsed.data.turnstileToken, ip, host);
  if (!ok) return { name: null };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("login_greeting_name", {
    p_email: parsed.data.email,
    p_client_key: sha256Hex(ip + salt),
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
