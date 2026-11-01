import { describe, expect, it } from "vitest";
import { boardLabels, formatLabelInput, hasLabel, parseLabelInput } from "@/lib/boards/labels";
import { createCardSchema, updateCardSchema } from "@/lib/boards/schemas";

const ID = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";

describe("parseLabelInput", () => {
  it("splits on commas, trims, collapses spaces and drops empties and case duplicates", () => {
    expect(parseLabelInput(" werk,  Thuis ,, werk , WERK, lange   naam")).toEqual(["werk", "Thuis", "lange naam"]);
  });

  it("round-trips with formatLabelInput", () => {
    expect(parseLabelInput(formatLabelInput([{ name: "a" }, { name: "b" }]))).toEqual(["a", "b"]);
    expect(parseLabelInput("")).toEqual([]);
  });
});

describe("card schemas", () => {
  it("accept an optional label set within limits", () => {
    expect(updateCardSchema.safeParse({ cardId: ID, title: "x", labels: ["werk"] }).success).toBe(true);
    expect(updateCardSchema.safeParse({ cardId: ID, title: "x" }).success).toBe(true);
    expect(createCardSchema.safeParse({ columnId: ID, title: "x", labels: ["x".repeat(41)] }).success).toBe(false);
    expect(createCardSchema.safeParse({ columnId: ID, title: "x", labels: Array.from({ length: 11 }, (_, i) => `l${i}`) }).success).toBe(false);
  });
});

describe("boardLabels and hasLabel", () => {
  const columns = [
    { cards: [{ labels: [{ id: "l2", name: "werk" }] }, { labels: [] }] },
    { cards: [{ labels: [{ id: "l1", name: "thuis" }, { id: "l2", name: "werk" }] }] },
  ];

  it("lists each used label once, by name", () => {
    expect(boardLabels(columns)).toEqual([
      { id: "l1", name: "thuis" },
      { id: "l2", name: "werk" },
    ]);
  });

  it("filters on one label, or passes everything without a filter", () => {
    expect(hasLabel({ labels: [{ id: "l1" }] }, "l1")).toBe(true);
    expect(hasLabel({ labels: [{ id: "l1" }] }, "l2")).toBe(false);
    expect(hasLabel({ labels: [] }, null)).toBe(true);
  });
});
