import { describe, expect, it } from "vitest";
import { isAdminFromClaims, requireUserIdResult, userIdFromClaims } from "@/lib/boards/claims";

// #168: unit tests for the pure mapping logic behind lib/boards/session.ts's
// cache()'d getAuthenticatedUserId/requireUserId. session.ts itself can't be
// imported here -- it's `import "server-only"`, which throws outside a
// server/react-server context (see lib/boards/claims.ts's own header note,
// and tests/recipes-thumbnails.test.ts for the same pattern already
// established in this codebase) -- so the claims -> userId mapping was split
// into this dependency-free module specifically to keep it testable.

describe("userIdFromClaims", () => {
  it("returns the sub claim when getClaims() succeeds", () => {
    expect(
      userIdFromClaims({
        data: { claims: { sub: "11111111-1111-1111-1111-111111111111" } },
        error: null,
      }),
    ).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("returns null when getClaims() returns an error", () => {
    expect(
      userIdFromClaims({
        data: null,
        // Structural stand-in for AuthError -- only .message/.status are
        // ever meaningfully distinct across AuthError subclasses, and
        // userIdFromClaims doesn't branch on either, just truthiness.
        error: { message: "invalid JWT", status: 401 } as never,
      }),
    ).toBeNull();
  });

  it("returns null when data is null with no error (signed out)", () => {
    expect(userIdFromClaims({ data: null, error: null })).toBeNull();
  });

  it("returns null when the claims carry no sub", () => {
    expect(userIdFromClaims({ data: { claims: {} }, error: null })).toBeNull();
  });
});

describe("requireUserIdResult", () => {
  it("wraps a resolved user id", () => {
    expect(requireUserIdResult("11111111-1111-1111-1111-111111111111")).toEqual({
      userId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("returns the unauthenticated ActionResult error for a null user id", () => {
    expect(requireUserIdResult(null)).toEqual({ error: "unauthenticated" });
  });
});

describe("isAdminFromClaims", () => {
  const sub = "11111111-1111-1111-1111-111111111111";

  it("is true for app_metadata.role admin", () => {
    expect(isAdminFromClaims({ data: { claims: { sub, app_metadata: { role: "admin" } } }, error: null })).toBe(true);
  });

  it("is false for another role or no app_metadata", () => {
    expect(isAdminFromClaims({ data: { claims: { sub, app_metadata: { role: "user" } } }, error: null })).toBe(false);
    expect(isAdminFromClaims({ data: { claims: { sub } }, error: null })).toBe(false);
  });

  it("is false when signed out, on an error, or without sub", () => {
    expect(isAdminFromClaims({ data: null, error: null })).toBe(false);
    expect(
      isAdminFromClaims({
        data: { claims: { sub, app_metadata: { role: "admin" } } },
        error: { message: "invalid JWT", status: 401 } as never,
      }),
    ).toBe(false);
    expect(isAdminFromClaims({ data: { claims: { app_metadata: { role: "admin" } } }, error: null })).toBe(false);
  });
});
