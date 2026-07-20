import { describe, expect, it } from "vitest";
import { magicLinkSchema, passwordLoginSchema } from "../lib/auth/schemas";

describe("passwordLoginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(
      passwordLoginSchema.safeParse({ email: "a@b.nl", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      passwordLoginSchema.safeParse({ email: "not-an-email", password: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      passwordLoginSchema.safeParse({ email: "a@b.nl", password: "" }).success,
    ).toBe(false);
  });

  it("rejects missing fields (FormData.get returning null)", () => {
    expect(
      passwordLoginSchema.safeParse({ email: null, password: null }).success,
    ).toBe(false);
  });
});

describe("magicLinkSchema", () => {
  it("accepts a valid email", () => {
    expect(magicLinkSchema.safeParse({ email: "a@b.nl" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(magicLinkSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
