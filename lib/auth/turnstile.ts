import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

// Shared by the greeting lookup (ADR-0031) and the login actions. Never log
// email, IP or token.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_ACTION = "login";
// Cloudflare's documented always-pass secret. Its Siteverify reply does not
// carry our action or hostname (dummy values), so those two checks are skipped
// for this secret only; success is still required. Never honoured in
// production: there it counts as a misconfiguration and verification fails.
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const MIN_SALT_LENGTH = 16;
// Used when LOGIN_GREETING_SALT is unset, so a missing salt never breaks login.
const FALLBACK_PEPPER = "atlas-login-client-key-v1";

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

// Lowercase, any port stripped (Siteverify reports the bare hostname).
const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/:\d+$/, "");

function allowedHostnames(requestHost: string | null): string[] {
  const configured = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return requestHost ? [normalizeHost(requestHost)] : [];
}

export interface RequestContext {
  ip: string;
  host: string | null;
  /** sha256(ip + salt): the only form of the IP that reaches the database. */
  clientKey: string;
}

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  // Vercel sets x-real-ip itself; x-forwarded-for is only a fallback.
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim() ?? null;
  const salt = process.env.LOGIN_GREETING_SALT;
  const pepper = salt && salt.length >= MIN_SALT_LENGTH ? salt : FALLBACK_PEPPER;
  return { ip, host, clientKey: sha256Hex(ip + pepper) };
}

export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string,
  host: string | null,
): Promise<boolean> {
  const isTestSecret = secret === TURNSTILE_TEST_SECRET;
  if (isTestSecret && process.env.VERCEL_ENV === "production") return false;
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
    if (isTestSecret) return true;
    return (
      body.action === TURNSTILE_ACTION &&
      typeof body.hostname === "string" &&
      allowedHostnames(host).includes(normalizeHost(body.hostname))
    );
  } catch {
    return false;
  }
}

/**
 * Bot check for a login submit. With no secret configured it is skipped
 * outside production (local/dev) and fails closed in production.
 */
export async function checkLoginTurnstile(token: unknown, ctx: RequestContext): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || token === "" || token.length > 2048) return false;
  return verifyTurnstile(secret, token, ctx.ip, ctx.host);
}
