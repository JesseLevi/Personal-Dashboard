import { describe, expect, it } from "vitest";
import { effectiveNotesSearchQuery, NOTES_SEARCH_MIN_QUERY_LENGTH } from "../lib/notes/search";

// #231: the threshold both notes-data.ts and NotitiesBoard.tsx rely on --
// covers the boundary itself, trimming, and the "no query at all" case.

describe("effectiveNotesSearchQuery", () => {
  it("returns '' for an empty string", () => {
    expect(effectiveNotesSearchQuery("")).toBe("");
  });

  it("returns '' for a query below the minimum length", () => {
    expect(effectiveNotesSearchQuery("h")).toBe("");
  });

  it("returns the trimmed query once it reaches the minimum length", () => {
    expect(NOTES_SEARCH_MIN_QUERY_LENGTH).toBe(2);
    expect(effectiveNotesSearchQuery("ho")).toBe("ho");
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(effectiveNotesSearchQuery("  h  ")).toBe("");
    expect(effectiveNotesSearchQuery("  ho  ")).toBe("ho");
  });

  it("returns '' for whitespace-only input", () => {
    expect(effectiveNotesSearchQuery("   ")).toBe("");
  });

  it("passes through a longer query unchanged (trimmed)", () => {
    expect(effectiveNotesSearchQuery(" honden uitlaten ")).toBe("honden uitlaten");
  });
});
