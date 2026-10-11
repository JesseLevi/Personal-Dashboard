import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPasswordMock, redirectMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  redirectMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: signInWithPasswordMock } }),
}));
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
    signInWithPasswordMock.mockReset();
    redirectMock.mockReset();
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
});
