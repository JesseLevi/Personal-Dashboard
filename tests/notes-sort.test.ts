import { describe, expect, it } from "vitest";
import { isNoteSortOption, NOTE_SORT_OPTIONS, sortNotesForView } from "../lib/notes/sort";
import type { NoteSummaryRow } from "../lib/notes/types";

// Minimal fixture -- only the fields sortNotesForView actually reads.
function note(overrides: Partial<NoteSummaryRow>): NoteSummaryRow {
  return {
    id: "id",
    category_id: "category",
    title: "Titel",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    snippet: "",
    ...overrides,
  };
}

describe("isNoteSortOption", () => {
  it("accepts every declared option", () => {
    for (const option of NOTE_SORT_OPTIONS) expect(isNoteSortOption(option)).toBe(true);
  });

  it("rejects anything else, including the boards-only options", () => {
    expect(isNoteSortOption("priority")).toBe(false);
    expect(isNoteSortOption("size")).toBe(false);
    expect(isNoteSortOption("")).toBe(false);
  });
});

describe("sortNotesForView", () => {
  const a = note({ id: "a", title: "Boodschappen", created_at: "2026-01-03T00:00:00.000Z" });
  const b = note({ id: "b", title: "Agenda", created_at: "2026-01-01T00:00:00.000Z" });
  const c = note({ id: "c", title: "citroentaart", created_at: "2026-01-02T00:00:00.000Z" });
  const notes = [a, b, c];

  it("returns the same order untouched when sort is null (manual/position)", () => {
    expect(sortNotesForView(notes, null)).toBe(notes);
  });

  it("sorts by created_at ascending", () => {
    expect(sortNotesForView(notes, "createdAt").map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts alphabetically by title, case-insensitively", () => {
    expect(sortNotesForView(notes, "alphabetical").map((n) => n.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input array", () => {
    const original = [...notes];
    sortNotesForView(notes, "alphabetical");
    expect(notes).toEqual(original);
  });
});
