import { describe, expect, it } from "vitest";
import { memberAvatarSrc, memberFullName, toAvatarGroupMembers } from "@/lib/sharing/member";

describe("memberAvatarSrc", () => {
  it("returns null without a photo", () => {
    expect(memberAvatarSrc({ id: "a", hasAvatar: false, updatedAt: "2026-10-12T10:00:00Z" })).toBeNull();
  });

  it("builds the avatar route with an encoded cache key", () => {
    expect(memberAvatarSrc({ id: "abc", hasAvatar: true, updatedAt: "2026-10-12T10:00:00+00:00" })).toBe(
      "/api/avatar/abc?v=2026-10-12T10%3A00%3A00%2B00%3A00",
    );
  });
});

describe("memberFullName", () => {
  it("joins first and last name", () => {
    expect(memberFullName({ displayName: "Jesse", lastName: "Kamps" }, "?")).toBe("Jesse Kamps");
  });

  it("skips empty parts", () => {
    expect(memberFullName({ displayName: "Jesse", lastName: " " }, "?")).toBe("Jesse");
    expect(memberFullName({ displayName: null, lastName: "Kamps" }, "?")).toBe("Kamps");
  });

  it("falls back when there is no name", () => {
    expect(memberFullName({ displayName: null, lastName: null }, "Naamloos")).toBe("Naamloos");
  });
});

describe("toAvatarGroupMembers", () => {
  it("keeps the given order, uses full names and sets src only with a photo", () => {
    const owner = { id: "o", displayName: "Jesse", lastName: "Kamps", hasAvatar: true, updatedAt: "v1" };
    const lid = { id: "m", displayName: "Youri", lastName: null, hasAvatar: false, updatedAt: "v2" };
    expect(toAvatarGroupMembers([owner, lid], "?")).toEqual([
      { id: "o", name: "Jesse Kamps", src: "/api/avatar/o?v=v1" },
      { id: "m", name: "Youri", src: null },
    ]);
  });
});
