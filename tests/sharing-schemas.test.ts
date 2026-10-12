import { describe, expect, it } from "vitest";
import {
  inviteMemberSchema,
  memberProfilesSchema,
  resourceRefSchema,
  resourceTypeSchema,
  revokeShareSchema,
  searchMembersSchema,
} from "../lib/sharing/schemas";

const ID = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

describe("sharing schemas", () => {
  it("accepts only known resource types", () => {
    expect(resourceTypeSchema.safeParse("shopping_list").success).toBe(true);
    expect(resourceTypeSchema.safeParse("recipe").success).toBe(false);
  });

  it("requires a resource type and a uuid", () => {
    expect(resourceRefSchema.safeParse({ resource: "shopping_list", id: ID }).success).toBe(true);
    expect(resourceRefSchema.safeParse({ resource: "shopping_list", id: "nope" }).success).toBe(false);
    expect(resourceRefSchema.safeParse({ resource: "board", id: ID }).success).toBe(false);
    expect(resourceRefSchema.safeParse({ id: ID }).success).toBe(false);
  });

  it("invite and revoke also need a member uuid", () => {
    const ok = { resource: "shopping_list", id: ID, memberId: OTHER };
    expect(inviteMemberSchema.safeParse(ok).success).toBe(true);
    expect(revokeShareSchema.safeParse(ok).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ resource: "shopping_list", id: ID }).success).toBe(false);
    expect(revokeShareSchema.safeParse({ ...ok, memberId: "x" }).success).toBe(false);
  });

  it("search trims and bounds the query to 2-64 characters", () => {
    expect(searchMembersSchema.parse({ query: "  an " }).query).toBe("an");
    expect(searchMembersSchema.safeParse({ query: "a" }).success).toBe(false);
    expect(searchMembersSchema.safeParse({ query: " a " }).success).toBe(false);
    expect(searchMembersSchema.safeParse({ query: "a".repeat(64) }).success).toBe(true);
    expect(searchMembersSchema.safeParse({ query: "a".repeat(65) }).success).toBe(false);
    expect(searchMembersSchema.safeParse({}).success).toBe(false);
  });

  it("member profile lookups take at most 100 uuids", () => {
    expect(memberProfilesSchema.safeParse({ ids: [ID] }).success).toBe(true);
    expect(memberProfilesSchema.safeParse({ ids: ["x"] }).success).toBe(false);
    expect(memberProfilesSchema.safeParse({ ids: Array(101).fill(ID) }).success).toBe(false);
  });
});
