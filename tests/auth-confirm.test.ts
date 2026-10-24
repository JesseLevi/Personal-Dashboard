import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtpMock, redirectMock, cookieSet, cookieGet } = vi.hoisted(() => ({
  verifyOtpMock: vi.fn(),
  // Like Next's redirect(): never returns.
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: verifyOtpMock } }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: cookieGet }) }));

import { confirmMagicLink } from "../app/auth/confirm/actions";
import AuthConfirmPage from "../app/auth/confirm/page";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const redirectedTo = async (run: () => Promise<unknown>) => {
  await expect(run()).rejects.toThrow(/NEXT_REDIRECT/);
  return redirectMock.mock.calls.at(-1)?.[0];
};

beforeEach(() => {
  for (const mock of [verifyOtpMock, cookieSet, cookieGet]) mock.mockReset();
  redirectMock.mockClear();
});

describe("confirmMagicLink (the POST)", () => {
  it("verifies the token and sends the user to /te-doen", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    const target = await redirectedTo(() => confirmMagicLink(form({ token_hash: "abc", type: "email" })));
    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(target).toBe("/te-doen");
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "", expect.objectContaining({ maxAge: 0 }));
  });

  it("sends an invalid or expired token to the existing error", async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: "expired" } });
    const target = await redirectedTo(() => confirmMagicLink(form({ token_hash: "abc", type: "email" })));
    expect(target).toBe("/login?error=magic-link-invalid");
  });

  it.each([
    ["missing token", { type: "email" }],
    ["empty token", { token_hash: "", type: "email" }],
    ["oversized token", { token_hash: "x".repeat(513), type: "email" }],
    ["missing type", { token_hash: "abc" }],
    ["unknown type", { token_hash: "abc", type: "bogus" }],
    ["recovery type", { token_hash: "abc", type: "recovery" }],
  ])("rejects %s without calling verifyOtp", async (_name, fields) => {
    const target = await redirectedTo(() => confirmMagicLink(form(fields)));
    expect(target).toBe("/login?error=magic-link-invalid");
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirm (the page)", () => {
  const params = (p: { token_hash?: string; type?: string }) => ({ searchParams: Promise.resolve(p) });

  it("never verifies the token, with or without the login cookie", async () => {
    cookieGet.mockReturnValue({ value: "jesse@example.com" });
    const known = await AuthConfirmPage(params({ token_hash: "abc", type: "email" }));
    expect(known.props).toMatchObject({ maskedEmail: "j****@example.com", tokenHash: "abc", type: "email" });

    cookieGet.mockReturnValue(undefined);
    const unknown = await AuthConfirmPage(params({ token_hash: "abc", type: "email" }));
    expect(unknown.props).toMatchObject({ maskedEmail: null });

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("sends a link without a token or with a bad type to the error, still without verifying", async () => {
    expect(await redirectedTo(() => AuthConfirmPage(params({})))).toBe("/login?error=magic-link-invalid");
    expect(await redirectedTo(() => AuthConfirmPage(params({ token_hash: "abc", type: "recovery" })))).toBe(
      "/login?error=magic-link-invalid",
    );
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });
});
