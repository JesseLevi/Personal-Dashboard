import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({ createSupabaseAnonClient: () => ({ rpc }) }));

let headerMap: Record<string, string> = {};
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap[k] ?? null }),
}));

import { consumeLoginAttempt } from "../lib/auth/login-rate-limit";
import { checkLoginTurnstile, getRequestContext, TURNSTILE_TEST_SECRET } from "../lib/auth/turnstile";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  headerMap = { "x-real-ip": "9.9.9.9", host: "atlas.test" };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("consumeLoginAttempt", () => {
  it("calls the RPC with action, address and client key", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await consumeLoginAttempt("verify", "a@b.nl", "key")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("login_rate_limit", {
      p_action: "verify",
      p_email: "a@b.nl",
      p_client_key: "key",
    });
  });

  it("refuses when the database says no", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await consumeLoginAttempt("send", "a@b.nl", "key")).toBe(false);
  });

  it.each(["PGRST202", "42883"])("lets the call through, loudly, when the function is missing (%s)", async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "missing" } });
    expect(await consumeLoginAttempt("password", "a@b.nl", "key")).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("a@b.nl");
  });

  it("refuses on any other database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "down" } });
    expect(await consumeLoginAttempt("password", "a@b.nl", "key")).toBe(false);
  });

  it("refuses when the call throws", async () => {
    rpc.mockRejectedValue(new Error("network"));
    expect(await consumeLoginAttempt("send", "a@b.nl", "key")).toBe(false);
  });

  it("refuses on an unexpected payload", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await consumeLoginAttempt("send", "a@b.nl", "key")).toBe(false);
  });
});

describe("getRequestContext", () => {
  it("hashes the client IP and never exposes it in the key", async () => {
    vi.stubEnv("LOGIN_GREETING_SALT", "test-salt-0123456789abcdef");
    const ctx = await getRequestContext();
    expect(ctx.clientKey).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.clientKey).not.toContain("9.9.9.9");
  });

  it("still yields a per-client key without a salt", async () => {
    vi.stubEnv("LOGIN_GREETING_SALT", "");
    const a = await getRequestContext();
    headerMap["x-real-ip"] = "8.8.8.8";
    const b = await getRequestContext();
    expect(a.clientKey).toMatch(/^[0-9a-f]{64}$/);
    expect(a.clientKey).not.toBe(b.clientKey);
  });
});

describe("checkLoginTurnstile", () => {
  const ctx = { ip: "9.9.9.9", host: "atlas.test", clientKey: "k" };

  it("passes with a valid token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: "login", hostname: "atlas.test" }),
    });
    expect(await checkLoginTurnstile("tok", ctx)).toBe(true);
  });

  it.each([null, undefined, "", 5])("fails with token %j when a secret is set", async (token) => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
    expect(await checkLoginTurnstile(token, ctx)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails on a rejected token or a wrong action", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    expect(await checkLoginTurnstile("tok", ctx)).toBe(false);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: "login_greeting", hostname: "atlas.test" }),
    });
    expect(await checkLoginTurnstile("tok", ctx)).toBe(false);
  });

  it("is skipped without a secret outside production (local/dev)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    expect(await checkLoginTurnstile(null, ctx)).toBe(true);
  });

  it("fails closed without a secret in production", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await checkLoginTurnstile("tok", ctx)).toBe(false);
  });

  it("rejects Cloudflare's test secret in production", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_TEST_SECRET);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await checkLoginTurnstile("tok", ctx)).toBe(false);
  });
});
