import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPasswordMock, redirectMock, consumeMock, refundMock, turnstileMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  redirectMock: vi.fn(),
  consumeMock: vi.fn(),
  refundMock: vi.fn(),
  turnstileMock: vi.fn(),
}));
vi.mock("@/lib/auth/login-rate-limit", () => ({
  consumeLoginAttempt: consumeMock,
  refundLoginAttempt: refundMock,
}));
vi.mock("@/lib/auth/turnstile", () => ({
  getRequestContext: async () => ({ ip: "1.2.3.4", host: "atlas.test", clientKey: "client-key" }),
  checkLoginTurnstile: turnstileMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: signInWithPasswordMock } }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));

import { signInWithPassword } from "../app/login/actions";

function form(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

describe("signInWithPassword", () => {
  beforeEach(() => {
    for (const mock of [signInWithPasswordMock, redirectMock, consumeMock, refundMock, turnstileMock]) mock.mockReset();
    consumeMock.mockResolvedValue(true);
    turnstileMock.mockResolvedValue(true);
  });

  it("returns success without redirecting, so the form can play its exit first", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const state = await signInWithPassword({ status: "idle" }, form("a@b.nl", "secret"));
    expect(state).toEqual({ status: "success" });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "a@b.nl", password: "secret" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("collapses a Supabase error into invalid-credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: new Error("nope") });
    const state = await signInWithPassword({ status: "idle" }, form("a@b.nl", "wrong"));
    expect(state).toEqual({ status: "error", errorKey: "invalid-credentials" });
  });

  it("rejects malformed input before calling Supabase", async () => {
    const state = await signInWithPassword({ status: "idle" }, form("not-an-email", ""));
    expect(state).toEqual({ status: "error", errorKey: "invalid-input" });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("counts the attempt per address and client, and gives it back on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    await signInWithPassword({ status: "idle" }, form("a@b.nl", "secret"));
    expect(consumeMock).toHaveBeenCalledWith("password", "a@b.nl", "client-key");
    expect(refundMock).toHaveBeenCalledWith("password", "a@b.nl", "client-key");
  });

  it("keeps the attempt counted after a wrong password", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: new Error("nope") });
    await signInWithPassword({ status: "idle" }, form("a@b.nl", "wrong"));
    expect(refundMock).not.toHaveBeenCalled();
  });

  it("refuses with rate-limited over the limit, without asking Supabase", async () => {
    consumeMock.mockResolvedValue(false);
    const state = await signInWithPassword({ status: "idle" }, form("a@b.nl", "secret"));
    expect(state).toEqual({ status: "error", errorKey: "rate-limited" });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("refuses a failed bot check before counting or signing in", async () => {
    turnstileMock.mockResolvedValue(false);
    const data = form("a@b.nl", "secret");
    data.set("turnstileToken", "tok");
    const state = await signInWithPassword({ status: "idle" }, data);
    expect(state).toEqual({ status: "error", errorKey: "rate-limited" });
    expect(turnstileMock).toHaveBeenCalledWith("tok", expect.objectContaining({ clientKey: "client-key" }));
    expect(consumeMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});
