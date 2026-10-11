import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const headerValues: Record<string, string> = {};
vi.mock("next/headers", () => ({
  headers: async () => new Headers(headerValues),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

import { createHash } from "node:crypto";
import { lookupGreetingName, MIN_DURATION_MS } from "@/lib/auth/greeting-lookup";

const fetchMock = vi.fn();
const valid = { email: "Carlotta@Example.com", token: "tok" };

function siteverify(body: Record<string, unknown>, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body });
}

const keyFor = (ip: string) => createHash("sha256").update(`${ip}salt`).digest("hex");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret");
  vi.stubEnv("LOGIN_GREETING_SALT", "salt");
  for (const k of Object.keys(headerValues)) delete headerValues[k];
  Object.assign(headerValues, { host: "atlas.example", "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
  rpc.mockResolvedValue({ data: "Carlotta", error: null });
  siteverify({ success: true, action: "login_greeting", hostname: "atlas.example" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  rpc.mockReset();
});

describe("lookupGreetingName", () => {
  it("returns the first name and calls the RPC with a hashed client key", async () => {
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: "Carlotta" });
    expect(rpc).toHaveBeenCalledWith("login_greeting_name", {
      p_email: "Carlotta@Example.com",
      p_client_key: keyFor("203.0.113.5"),
    });
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("secret")).toBe("real-secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.5");
  });

  it.each([
    ["missing secret", () => vi.stubEnv("TURNSTILE_SECRET_KEY", "")],
    ["missing salt", () => vi.stubEnv("LOGIN_GREETING_SALT", "")],
    ["network error", () => fetchMock.mockRejectedValue(new Error("down"))],
    ["http error", () => siteverify({ success: true }, false)],
    ["failed verification", () => siteverify({ success: false })],
    ["wrong action", () => siteverify({ success: true, action: "other", hostname: "atlas.example" })],
    ["wrong hostname", () => siteverify({ success: true, action: "login_greeting", hostname: "evil.example" })],
  ])("fails closed without calling the RPC: %s", async (_label, arrange) => {
    arrange();
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid input without any network call", async () => {
    await expect(lookupGreetingName({ email: "nope", token: "t" })).resolves.toEqual({ name: null });
    await expect(lookupGreetingName({ email: "a@b.nl", token: "" })).resolves.toEqual({ name: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the always-pass test secret without echoed action/hostname", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    siteverify({ success: true, hostname: "example.com" });
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: "Carlotta" });
  });

  it("falls back to x-real-ip, then to a fixed key", async () => {
    delete headerValues["x-forwarded-for"];
    headerValues["x-real-ip"] = "198.51.100.7";
    await lookupGreetingName(valid);
    expect(rpc.mock.calls[0][1].p_client_key).toBe(keyFor("198.51.100.7"));
    delete headerValues["x-real-ip"];
    await lookupGreetingName(valid);
    expect(rpc.mock.calls[1][1].p_client_key).toBe(keyFor("unknown"));
  });

  it("returns null for an RPC error, a null name or a blank name", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: null });
    rpc.mockResolvedValueOnce({ data: "  ", error: null });
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: null });
  });

  it("returns null when the RPC throws", async () => {
    rpc.mockRejectedValueOnce(new Error("boom"));
    await expect(lookupGreetingName(valid)).resolves.toEqual({ name: null });
  });

  it("pads the duration to the minimum, on success and on a fast failure", async () => {
    for (const input of [valid, { email: "bad", token: "t" }]) {
      const t0 = Date.now();
      await lookupGreetingName(input);
      expect(Date.now() - t0).toBeGreaterThanOrEqual(MIN_DURATION_MS - 20);
    }
  });
});
