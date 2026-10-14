import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  linkErrorCode,
  linkHref,
  linkInputSchema,
  linkSearchInputSchema,
  sortEventRefs,
  unlinkInputSchema,
  type AgendaEventRef,
} from "@/lib/agenda/links";

const ID = "6f1c0a52-3c0e-4b0e-9b6a-0d6f3f1c2a10";
const OTHER = "7a2d1b63-4d1f-4c1f-8c7b-1e7a4a2d3b21";

describe("link input schemas", () => {
  it("accepts a link for each kind", () => {
    for (const kind of ["recipe", "card", "note"]) {
      expect(linkInputSchema.safeParse({ eventId: ID, kind, targetId: OTHER }).success).toBe(true);
    }
  });

  it("rejects unknown kinds, non-uuids and missing fields", () => {
    expect(linkInputSchema.safeParse({ eventId: ID, kind: "meal", targetId: OTHER }).success).toBe(false);
    expect(linkInputSchema.safeParse({ eventId: "x", kind: "note", targetId: OTHER }).success).toBe(false);
    expect(linkInputSchema.safeParse({ eventId: ID, kind: "note" }).success).toBe(false);
    expect(unlinkInputSchema.safeParse({ linkId: "nope" }).success).toBe(false);
  });

  it("bounds and trims the search query", () => {
    expect(linkSearchInputSchema.parse({ query: "  soep " }).query).toBe("soep");
    expect(linkSearchInputSchema.safeParse({ query: "a" }).success).toBe(false);
    expect(linkSearchInputSchema.safeParse({ query: "x".repeat(65) }).success).toBe(false);
  });
});

describe("linkErrorCode", () => {
  it("maps database errors to codes, never to messages", () => {
    expect(linkErrorCode({ code: "23505" })).toBe("already-linked");
    expect(linkErrorCode({ code: "42501" })).toBe("forbidden");
    expect(linkErrorCode({ code: "23503" })).toBe("not-found");
    expect(linkErrorCode({ code: "XX000" })).toBe("generic");
  });
});

describe("linkHref", () => {
  it("points to the page that shows the target", () => {
    expect(linkHref("recipe", ID)).toBe(`/recepten/${ID}`);
    expect(linkHref("note", ID)).toBe(`/notities/${ID}`);
    expect(linkHref("card", ID)).toBe(`/te-doen?card=${ID}`);
  });
});

describe("sortEventRefs", () => {
  const ref = (id: string, startsAt: string): AgendaEventRef => ({ id, title: id, startsAt, allDay: false });

  it("puts upcoming events first, soonest first, then past ones, newest first", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const sorted = sortEventRefs(
      [
        ref("old", "2026-09-01T10:00:00Z"),
        ref("later", "2026-11-01T10:00:00Z"),
        ref("recent", "2026-10-10T10:00:00Z"),
        ref("soon", "2026-10-15T10:00:00Z"),
      ],
      now,
    );
    expect(sorted.map((r) => r.id)).toEqual(["soon", "later", "recent", "old"]);
  });
});

const session = vi.hoisted(() => ({ requireUserId: vi.fn() }));
const db = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/boards/session", () => session);
vi.mock("@/lib/agenda/link-queries", () => ({
  getEventLinks: vi.fn(),
  getEventRefsForTarget: vi.fn(),
  searchLinkTargets: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => {
  const chain: Record<string, unknown> = {};
  for (const name of ["from", "insert", "delete", "select", "eq"]) chain[name] = () => chain;
  chain.single = async () => db.result;
  chain.maybeSingle = async () => db.result;
  return { createSupabaseServerClient: async () => chain };
});

describe("link actions", () => {
  beforeEach(() => {
    session.requireUserId.mockResolvedValue({ userId: ID });
    db.result = { data: null, error: null };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("linkToEvent refuses invalid input before touching the database", async () => {
    const { linkToEvent } = await import("@/app/(app)/agenda/link-actions");
    expect(await linkToEvent({ eventId: "x" })).toEqual({ success: false, error: "invalid-input" });
  });

  it("linkToEvent refuses a signed-out caller", async () => {
    session.requireUserId.mockResolvedValue({ error: "unauthenticated" });
    const { linkToEvent } = await import("@/app/(app)/agenda/link-actions");
    expect(await linkToEvent({ eventId: ID, kind: "note", targetId: OTHER })).toEqual({
      success: false,
      error: "unauthenticated",
    });
  });

  it("linkToEvent returns the new link id", async () => {
    db.result = { data: { id: OTHER }, error: null };
    const { linkToEvent } = await import("@/app/(app)/agenda/link-actions");
    expect(await linkToEvent({ eventId: ID, kind: "recipe", targetId: OTHER })).toEqual({
      success: true,
      data: { id: OTHER },
    });
  });

  it("linkToEvent maps a unique violation and an RLS refusal to their codes", async () => {
    const { linkToEvent } = await import("@/app/(app)/agenda/link-actions");
    db.result = { data: null, error: { code: "23505", message: "duplicate key value" } };
    expect(await linkToEvent({ eventId: ID, kind: "card", targetId: OTHER })).toEqual({
      success: false,
      error: "already-linked",
    });
    db.result = { data: null, error: { code: "42501", message: "new row violates row-level security" } };
    expect(await linkToEvent({ eventId: ID, kind: "card", targetId: OTHER })).toEqual({
      success: false,
      error: "forbidden",
    });
  });

  it("unlinkFromEvent reports a missing link as not-found", async () => {
    const { unlinkFromEvent } = await import("@/app/(app)/agenda/link-actions");
    expect(await unlinkFromEvent({ linkId: ID })).toEqual({ success: false, error: "not-found" });
    db.result = { data: { id: ID }, error: null };
    expect(await unlinkFromEvent({ linkId: ID })).toEqual({ success: true, data: undefined });
  });
});
