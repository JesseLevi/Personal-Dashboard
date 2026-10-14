import { describe, expect, it } from "vitest";
import { isSortOption, sortCardsForView, SORT_OPTIONS } from "../lib/boards/sort";
import type { CardWithLabels } from "../lib/boards/types";

// Minimal fixture — only the fields sortCardsForView actually reads.
function card(overrides: Partial<CardWithLabels>): CardWithLabels {
  return {
    id: "id",
    user_id: "user",
    column_id: "column",
    title: "Title",
    description: null,
    priority: "medium",
    size: null,
    due_at: null,
    planned_for: null,
    position: 1000,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    labels: [],
    ...overrides,
  };
}

describe("isSortOption", () => {
  it("accepts every declared option", () => {
    for (const option of SORT_OPTIONS) expect(isSortOption(option)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSortOption("position")).toBe(false);
    expect(isSortOption("")).toBe(false);
  });
});

describe("sortCardsForView", () => {
  const a = card({ id: "a", title: "Banaan", priority: "low", size: "xl", created_at: "2026-01-03T00:00:00.000Z" });
  const b = card({ id: "b", title: "Appel", priority: "urgent", size: "s", created_at: "2026-01-01T00:00:00.000Z" });
  const c = card({ id: "c", title: "citroen", priority: "medium", size: null, created_at: "2026-01-02T00:00:00.000Z" });
  const cards = [a, b, c];

  it("returns the same order untouched when sort is null (manual/position)", () => {
    expect(sortCardsForView(cards, null)).toBe(cards);
  });

  it("sorts by created_at ascending", () => {
    expect(sortCardsForView(cards, "createdAt").map((card) => card.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by priority urgent > medium > low", () => {
    expect(sortCardsForView(cards, "priority").map((card) => card.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by size ascending, nulls last", () => {
    expect(sortCardsForView(cards, "size").map((card) => card.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts alphabetically by title, case-insensitively", () => {
    expect(sortCardsForView(cards, "alphabetical").map((card) => card.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input array", () => {
    const original = [...cards];
    sortCardsForView(cards, "alphabetical");
    expect(cards).toEqual(original);
  });
});
