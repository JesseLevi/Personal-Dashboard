import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, cookieGet } = vi.hoisted(() => ({ cookieSet: vi.fn(), cookieGet: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: cookieGet }) }));

import { clearLoginEmail, getLoginEmail, setLoginEmail } from "@/lib/auth/login-email-cookie";
import { maskEmail } from "@/lib/auth/mask-email";

beforeEach(() => {
  cookieSet.mockReset();
  cookieGet.mockReset();
});

describe("login e-mail cookie", () => {
  it("is httpOnly, Lax, scoped to the site root and lives ten minutes", async () => {
    await setLoginEmail("a@b.nl");
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "a@b.nl", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  });

  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const fresh = await import("@/lib/auth/login-email-cookie");
    await fresh.setLoginEmail("a@b.nl");
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "a@b.nl", expect.objectContaining({ secure: true }));
    vi.unstubAllEnvs();
  });

  it("reads a valid address back", async () => {
    cookieGet.mockReturnValue({ value: "a@b.nl" });
    expect(await getLoginEmail()).toBe("a@b.nl");
  });

  it.each([undefined, { value: "" }, { value: "not-an-email" }])("reads %j as no address", async (stored) => {
    cookieGet.mockReturnValue(stored);
    expect(await getLoginEmail()).toBeNull();
  });

  it("clears with maxAge 0 on the same path", async () => {
    await clearLoginEmail();
    expect(cookieSet).toHaveBeenCalledWith("atlas_login_email", "", expect.objectContaining({ maxAge: 0, path: "/" }));
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the domain", () => {
    expect(maskEmail("jesse@example.com")).toBe("j****@example.com");
    expect(maskEmail("ab@example.com")).toBe("a*@example.com");
    expect(maskEmail("a@example.com")).toBe("a@example.com");
  });

  it("caps the stars so the length stays private", () => {
    expect(maskEmail("a.very.long.address@example.com")).toBe("a****@example.com");
  });
});
