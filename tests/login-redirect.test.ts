import { describe, expect, it } from "vitest";
import { shouldRedirectAuthenticated } from "@/lib/auth/login-redirect";

describe("shouldRedirectAuthenticated", () => {
  it("redirects a signed-in user on a plain request", () => {
    expect(shouldRedirectAuthenticated({ userId: "u1", isServerAction: false })).toBe(true);
  });

  it("does not redirect during a Server Action re-render", () => {
    expect(shouldRedirectAuthenticated({ userId: "u1", isServerAction: true })).toBe(false);
  });

  it("never redirects an anonymous user", () => {
    expect(shouldRedirectAuthenticated({ userId: null, isServerAction: false })).toBe(false);
    expect(shouldRedirectAuthenticated({ userId: undefined, isServerAction: true })).toBe(false);
  });
});
