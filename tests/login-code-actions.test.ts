import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  signInWithOtpMock,
  verifyOtpMock,
  redirectMock,
  cookieSet,
  cookieGet,
  consumeMock,
  turnstileMock,
} = vi.hoisted(() => ({
  consumeMock: vi.fn(),
  turnstileMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  redirectMock: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/login-rate-limit", () => ({
  consumeLoginAttempt: consumeMock,
}));
vi.mock("@/lib/auth/turnstile", () => ({
  getRequestContext: async () => ({ ip: "1.2.3.4", host: "atlas.test", clientKey: "client-key" }),
  checkLoginTurnstile: turnstileMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithOtp: signInWithOtpMock, verifyOtp: verifyOtpMock },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "https://atlas.test" }),
  cookies: async () => ({ set: cookieSet, get: cookieGet }),
}));

import {
  changeLoginEmail,
  resendLoginCode,
  sendLoginCode,
  verifyLoginCode,
} from "../app/login/actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const withCookie = (email: string | null) =>
  cookieGet.mockReturnValue(email === null ? undefined : { value: email });

const IDLE_SEND = { status: "idle" } as const;
const IDLE_VERIFY = { status: "idle" } as const;

beforeEach(() => {
  for (const mock of [signInWithOtpMock, verifyOtpMock, redirectMock, cookieSet, cookieGet, consumeMock, turnstileMock]) {
    mock.mockReset();
  }
  consumeMock.mockResolvedValue(true);
  turnstileMock.mockResolvedValue(true);
  withCookie(null);
});

describe("sendLoginCode", () => {
  it("asks Supabase for a code without creating users, sets the cookie and reports sent", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    const state = await sendLoginCode(IDLE_SEND, form({ email: "a@b.nl" }));
    expect(state).toEqual({ status: "sent" });
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "a@b.nl",
      options: { emailRedirectTo: "https://atlas.test/auth/confirm", shouldCreateUser: false },
    });
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "a@b.nl", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/login",
      maxAge: 600,
    });
  });

  it("looks sent for an unknown account, so the screen cannot enumerate users", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { status: 422, code: "otp_disabled" } });
    const state = await sendLoginCode(IDLE_SEND, form({ email: "nobody@b.nl" }));
    expect(state).toEqual({ status: "sent" });
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });

  it("maps a rate limit to rate-limited and sets no cookie", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    const state = await sendLoginCode(IDLE_SEND, form({ email: "a@b.nl" }));
    expect(state).toEqual({ status: "error", errorKey: "rate-limited" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("maps any other Supabase error to send-failed", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { status: 500, code: "unexpected_failure" } });
    const state = await sendLoginCode(IDLE_SEND, form({ email: "a@b.nl" }));
    expect(state).toEqual({ status: "error", errorKey: "send-failed" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a malformed address before calling Supabase", async () => {
    const state = await sendLoginCode(IDLE_SEND, form({ email: "nope" }));
    expect(state).toEqual({ status: "error", errorKey: "invalid-input" });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });
});

describe("resendLoginCode", () => {
  it("resends to the address in the cookie and stays on the page", async () => {
    withCookie("a@b.nl");
    signInWithOtpMock.mockResolvedValue({ error: null });
    const state = await resendLoginCode();
    expect(state).toEqual({ status: "sent" });
    expect(signInWithOtpMock).toHaveBeenCalledWith(expect.objectContaining({ email: "a@b.nl" }));
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports invalid-input when the cookie is gone", async () => {
    const state = await resendLoginCode();
    expect(state).toEqual({ status: "error", errorKey: "invalid-input" });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("maps a rate limit to rate-limited", async () => {
    withCookie("a@b.nl");
    signInWithOtpMock.mockResolvedValue({ error: { status: 429 } });
    expect(await resendLoginCode()).toEqual({ status: "error", errorKey: "rate-limited" });
  });
});

describe("verifyLoginCode", () => {
  it("verifies the code for the cookie's address, clears the cookie and reports success", async () => {
    withCookie("a@b.nl");
    verifyOtpMock.mockResolvedValue({ error: null });
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code: "123456" }));
    expect(state).toEqual({ status: "success" });
    expect(verifyOtpMock).toHaveBeenCalledWith({ email: "a@b.nl", token: "123456", type: "email" });
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "", expect.objectContaining({ maxAge: 0, path: "/login" }));
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("ignores an email field in the form: the address comes from the cookie only", async () => {
    withCookie("a@b.nl");
    verifyOtpMock.mockResolvedValue({ error: null });
    await verifyLoginCode(IDLE_VERIFY, form({ code: "123456", email: "victim@b.nl" }));
    expect(verifyOtpMock).toHaveBeenCalledWith(expect.objectContaining({ email: "a@b.nl" }));
  });

  it("maps a wrong or expired code to invalid-code and keeps the cookie", async () => {
    withCookie("a@b.nl");
    verifyOtpMock.mockResolvedValue({ error: { status: 403, code: "otp_expired" } });
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code: "000000" }));
    expect(state).toEqual({ status: "error", errorKey: "invalid-code" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("maps a 429 to rate-limited", async () => {
    withCookie("a@b.nl");
    verifyOtpMock.mockResolvedValue({ error: { status: 429, code: "over_request_rate_limit" } });
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code: "000000" }));
    expect(state).toEqual({ status: "error", errorKey: "rate-limited" });
  });

  it.each(["12345", "1234567", "12345a", "", "12 456"])("rejects %j before calling Supabase", async (code) => {
    withCookie("a@b.nl");
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code }));
    expect(state).toEqual({ status: "error", errorKey: "invalid-input" });
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("reports invalid-code without calling Supabase when the cookie is gone", async () => {
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code: "123456" }));
    expect(state).toEqual({ status: "error", errorKey: "invalid-code" });
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});

describe("changeLoginEmail", () => {
  it("clears the cookie and goes back to /login", async () => {
    await changeLoginEmail();
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "", expect.objectContaining({ maxAge: 0 }));
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("login rate limits and bot check", () => {
  it("send: refuses a failed bot check before counting or mailing", async () => {
    turnstileMock.mockResolvedValue(false);
    const data = form({ email: "a@b.nl", turnstileToken: "tok" });
    expect(await sendLoginCode(IDLE_SEND, data)).toEqual({ status: "error", errorKey: "rate-limited" });
    expect(turnstileMock).toHaveBeenCalledWith("tok", expect.objectContaining({ clientKey: "client-key" }));
    expect(consumeMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("send: over the per-address limit gives rate-limited, no mail, no cookie", async () => {
    consumeMock.mockResolvedValue(false);
    expect(await sendLoginCode(IDLE_SEND, form({ email: "a@b.nl" }))).toEqual({
      status: "error",
      errorKey: "rate-limited",
    });
    expect(consumeMock).toHaveBeenCalledWith("send", "a@b.nl", "client-key");
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("send: a limited unknown address answers like a limited known one", async () => {
    consumeMock.mockResolvedValue(false);
    const known = await sendLoginCode(IDLE_SEND, form({ email: "known@b.nl" }));
    const unknown = await sendLoginCode(IDLE_SEND, form({ email: "nobody@b.nl" }));
    expect(unknown).toEqual(known);
  });

  it("resend: counts against the same send budget, without a bot check", async () => {
    withCookie("a@b.nl");
    signInWithOtpMock.mockResolvedValue({ error: null });
    await resendLoginCode();
    expect(consumeMock).toHaveBeenCalledWith("send", "a@b.nl", "client-key");
    expect(turnstileMock).not.toHaveBeenCalled();
    consumeMock.mockResolvedValue(false);
    expect(await resendLoginCode()).toEqual({ status: "error", errorKey: "rate-limited" });
  });

  it("verify: over the per-address limit is refused without asking Supabase, whatever the cookie", async () => {
    withCookie("victim@b.nl");
    consumeMock.mockResolvedValue(false);
    const state = await verifyLoginCode(IDLE_VERIFY, form({ code: "123456" }));
    expect(state).toEqual({ status: "error", errorKey: "rate-limited" });
    expect(consumeMock).toHaveBeenCalledWith("verify", "victim@b.nl", "client-key");
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
