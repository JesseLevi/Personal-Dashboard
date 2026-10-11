import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ADR-0031: the login greeting's first-name lookup. Server-only; the only
// caller of public.login_greeting_name(). Fails closed at every step and
// always resolves to `{ name: string | null }` after at least MIN_DURATION_MS,
// so neither the outcome nor the timing separates known from unknown
// addresses. Never logs the address, the name or the IP.

export const TURNSTILE_ACTION = "login_greeting";
export const MIN_DURATION_MS = 500;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 3000;
const MAX_NAME_LENGTH = 64;
// Cloudflare's documented always-pass test secret (local/CI). Its Siteverify
// reply does not echo our action or hostname, so those two checks are skipped
// for this one value only; any real secret gets them.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

const inputSchema = z.object({
  email: z.email(),
  token: z.string().min(1).max(2048),
});

export interface GreetingLookupResult {
  name: string | null;
}

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

function requestHost(h: Headers): string {
  const raw = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  return raw.replace(/:\d+$/, "").toLowerCase();
}

function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0].trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
  host: string,
): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    if (data.success !== true) return false;
    if (secret === TURNSTILE_TEST_SECRET) return true;
    return data.action === TURNSTILE_ACTION && data.hostname?.toLowerCase() === host;
  } catch {
    return false;
  }
}

async function lookup(input: unknown): Promise<string | null> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return null;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const salt = process.env.LOGIN_GREETING_SALT;
  if (!secret || !salt) return null;

  const h = await headers();
  const ip = clientIp(h);
  if (!(await verifyTurnstile(parsed.data.token, secret, ip, requestHost(h)))) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("login_greeting_name", {
    p_email: parsed.data.email,
    p_client_key: sha256Hex(ip + salt),
  });
  if (error || typeof data !== "string") return null;
  const name = data.trim().slice(0, MAX_NAME_LENGTH);
  return name || null;
}

export async function lookupGreetingName(input: unknown): Promise<GreetingLookupResult> {
  const started = Date.now();
  let name: string | null = null;
  try {
    name = await lookup(input);
  } catch {
    name = null;
  }
  const remaining = MIN_DURATION_MS - (Date.now() - started);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return { name };
}
