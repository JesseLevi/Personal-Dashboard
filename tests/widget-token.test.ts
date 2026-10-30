import { describe, expect, it } from "vitest";
import { createWidgetTokenSchema, deleteWidgetTokenSchema } from "@/lib/widget/schemas";
import { generateWidgetToken, hashWidgetToken } from "@/lib/widget/token";

describe("generateWidgetToken", () => {
  it("has the prefix and 32 bytes of base64url", () => {
    expect(generateWidgetToken()).toMatch(/^atlas_wgt_[A-Za-z0-9_-]{43}$/);
  });

  it("is unique per call", () => {
    expect(generateWidgetToken()).not.toBe(generateWidgetToken());
  });
});

describe("hashWidgetToken", () => {
  it("is the lowercase hex SHA-256 of the full plaintext", () => {
    expect(hashWidgetToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("includes the prefix in the hash", () => {
    expect(hashWidgetToken("atlas_wgt_x")).not.toBe(hashWidgetToken("x"));
    expect(hashWidgetToken("atlas_wgt_x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("schemas", () => {
  it("trims the label and bounds it to 1-60", () => {
    expect(createWidgetTokenSchema.parse({ label: "  iPhone " }).label).toBe("iPhone");
    expect(createWidgetTokenSchema.safeParse({ label: "   " }).success).toBe(false);
    expect(createWidgetTokenSchema.safeParse({ label: "a".repeat(60) }).success).toBe(true);
    expect(createWidgetTokenSchema.safeParse({ label: "a".repeat(61) }).success).toBe(false);
  });

  it("needs a uuid to delete", () => {
    expect(deleteWidgetTokenSchema.safeParse({ id: "nope" }).success).toBe(false);
    expect(deleteWidgetTokenSchema.safeParse({ id: crypto.randomUUID() }).success).toBe(true);
  });
});
