import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({
  createSupabaseAnonClient: () => ({ rpc }),
}));

let headerMap: Record<string, string> = {};
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap[k] ?? null }),
}));

import { lookupGreetingName } from "../lib/auth/greeting-lookup";

const TEST_SECRET = "1x0000000000000000000000000000000AA";
const fetchMock = vi.fn();

function siteverify(body: object, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body });
}

// Resolves the action under fake timers.
async function run(input: { email: string; turnstileToken: string | null }) {
  const p = lookupGreetingName(input);
  await vi.advanceTimersByTimeAsync(600);
  return p;
}

const valid = { email: "a@b.nl", turnstileToken: "tok" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
  vi.stubEnv("LOGIN_GREETING_SALT", "test-salt-0123456789abcdef");
  headerMap = { "x-forwarded-for": "1.2.3.4, 5.6.7.8", host: "atlas.test" };
  rpc.mockResolvedValue({ data: "Carlotta", error: null });
  siteverify({ success: true, action: "login", hostname: "atlas.test" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("lookupGreetingName", () => {
  it("returns the name on success", async () => {
    expect(await run(valid)).toEqual({ name: "Carlotta" });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("login_greeting_name");
    expect(args.p_email).toBe("a@b.nl");
    expect(args.p_client_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("1.2.3.4");
  });

  it("sends secret, token and remote ip to Siteverify (x-real-ip first)", async () => {
    headerMap = { host: "atlas.test", "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" };
    await run(valid);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse(init.body)).toEqual({
      secret: "real-secret",
      response: "tok",
      remoteip: "9.9.9.9",
    });
  });

  it("compares the hostname lowercase and without port", async () => {
    headerMap = { host: "Atlas.test:3000" };
    siteverify({ success: true, action: "login", hostname: "ATLAS.test" });
    expect(await run(valid)).toEqual({ name: "Carlotta" });
  });

  it("uses TURNSTILE_ALLOWED_HOSTNAMES over the request host when set", async () => {
    vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "app.example, www.example");
    siteverify({ success: true, action: "login", hostname: "atlas.test" });
    expect(await run(valid)).toEqual({ name: null });
    siteverify({ success: true, action: "login", hostname: "WWW.example" });
    expect(await run(valid)).toEqual({ name: "Carlotta" });
  });

  it("honours the test secret outside production only", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
    vi.stubEnv("VERCEL_ENV", "preview");
    siteverify({ success: true, hostname: "example.com", action: "" });
    expect(await run(valid)).toEqual({ name: "Carlotta" });
  });

  it("accepts the Cloudflare test secret without action/hostname", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
    siteverify({ success: true, hostname: "example.com", action: "" });
    expect(await run(valid)).toEqual({ name: "Carlotta" });
  });

  const failClosed: [string, () => void, object?][] = [
    ["missing token", () => {}, { email: "a@b.nl", turnstileToken: null }],
    ["invalid email", () => {}, { email: "nope", turnstileToken: "tok" }],
    ["missing secret", () => vi.stubEnv("TURNSTILE_SECRET_KEY", "")],
    ["missing salt", () => vi.stubEnv("LOGIN_GREETING_SALT", "")],
    ["short salt", () => vi.stubEnv("LOGIN_GREETING_SALT", "short")],
    ["token too long", () => {}, { email: "a@b.nl", turnstileToken: "x".repeat(2049) }],
    ["email too long", () => {}, { email: `${"a".repeat(250)}@b.nl`, turnstileToken: "tok" }],
    ["test secret in production", () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
      vi.stubEnv("VERCEL_ENV", "production");
    }],
    ["network error", () => fetchMock.mockRejectedValue(new Error("boom"))],
    ["http error", () => siteverify({ success: true }, false)],
    ["failed verify", () => siteverify({ success: false })],
    [
      "wrong action",
      () => siteverify({ success: true, action: "x", hostname: "atlas.test" }),
    ],
    [
      "wrong hostname",
      () =>
        siteverify({ success: true, action: "login", hostname: "evil.test" }),
    ],
    [
      "non-test secret with an empty action",
      () => {
        vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AB");
        siteverify({ success: true, hostname: "example.com", action: "" });
      },
    ],
  ];

  it.each(failClosed)("%s -> null without calling the RPC", async (_n, setup, input) => {
    setup();
    expect(await run((input as typeof valid) ?? valid)).toEqual({ name: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null on an RPC error or null data", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await run(valid)).toEqual({ name: null });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await run(valid)).toEqual({ name: null });
  });

  it("pads to at least 500ms, also on early returns", async () => {
    for (const input of [valid, { email: "a@b.nl", turnstileToken: null }]) {
      let done = false;
      const p = lookupGreetingName(input).then((r) => {
        done = true;
        return r;
      });
      await vi.advanceTimersByTimeAsync(499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await p;
      expect(done).toBe(true);
    }
  });
});
