import { describe, expect, it } from "vitest";
import {
  LABELS_PER_CARD,
  LABEL_MAX_LENGTH,
  addLabels,
  boardLabels,
  filterLabelOptions,
  hasLabel,
  labelOptions,
  parseLabelInput,
  removeLabel,
  resolveFilterEnter,
  toggleLabel,
} from "@/lib/boards/labels";
import { createCardSchema, updateCardSchema } from "@/lib/boards/schemas";

const ID = "3f1c2a40-6b7d-4e8a-9c10-5a2b3c4d5e6f";

describe("parseLabelInput", () => {
  it("splits on commas, trims, collapses spaces and drops empties and case duplicates", () => {
    expect(parseLabelInput(" werk,  Thuis ,, werk , WERK, lange   naam")).toEqual(["werk", "Thuis", "lange naam"]);
  });

  it("gives nothing for empty text", () => {
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

describe("labelOptions", () => {
  it("merges the board's labels with the card's own, once each, alphabetical", () => {
    expect(labelOptions(["werk", "Thuis", "boodschappen"], ["WERK", "nieuw"])).toEqual(["boodschappen", "nieuw", "Thuis", "werk"]);
  });

  it("is empty without labels", () => {
    expect(labelOptions([], [])).toEqual([]);
  });
});

describe("filterLabelOptions", () => {
  const options = ["boodschappen", "Thuis", "werk", "werkgever"];

  it("keeps the names that contain the text, case ignored", () => {
    expect(filterLabelOptions(options, "  WERK ")).toEqual(["werk", "werkgever"]);
    expect(filterLabelOptions(options, "hu")).toEqual(["Thuis"]);
  });

  it("keeps everything for empty or blank text and nothing for a miss", () => {
    expect(filterLabelOptions(options, "")).toEqual(options);
    expect(filterLabelOptions(options, "   ")).toEqual(options);
    expect(filterLabelOptions(options, "zzz")).toEqual([]);
  });
});

describe("toggleLabel and removeLabel", () => {
  it("adds a name that is not selected and removes one that is, case ignored", () => {
    expect(toggleLabel(["werk"], "thuis")).toEqual({ labels: ["werk", "thuis"], error: null });
    expect(toggleLabel(["werk", "thuis"], "WERK")).toEqual({ labels: ["thuis"], error: null });
    expect(removeLabel(["werk", "thuis"], "Thuis")).toEqual(["werk"]);
  });

  it("refuses an eleventh label but still allows removing one", () => {
    const full = Array.from({ length: LABELS_PER_CARD }, (_, index) => `l${index}`);
    expect(toggleLabel(full, "extra")).toEqual({ labels: full, error: "limit" });
    expect(toggleLabel(full, "l3").labels).toHaveLength(LABELS_PER_CARD - 1);
  });
});

describe("addLabels", () => {
  it("applies the parseLabelInput rules: trim, collapse spaces, drop empties", () => {
    expect(addLabels(["werk"], "  lange   naam ")).toEqual({ labels: ["werk", "lange naam"], error: null });
    expect(addLabels(["werk"], "   ")).toEqual({ labels: ["werk"], error: null });
    expect(addLabels([], "a, b ,, c")).toEqual({ labels: ["a", "b", "c"], error: null });
  });

  it("does not add a name twice, case ignored", () => {
    expect(addLabels(["Werk"], "werk")).toEqual({ labels: ["Werk"], error: null });
    expect(addLabels([], "x, X")).toEqual({ labels: ["x"], error: null });
  });

  it("keeps the board's spelling of a name it already has", () => {
    expect(addLabels([], "werk", ["Thuis", "Werk"])).toEqual({ labels: ["Werk"], error: null });
  });

  it("refuses a name over the length limit and a card over the label limit, changing nothing", () => {
    const long = "x".repeat(LABEL_MAX_LENGTH + 1);
    expect(addLabels(["werk"], long)).toEqual({ labels: ["werk"], error: "too-long" });
    expect(addLabels(["werk"], "x".repeat(LABEL_MAX_LENGTH)).error).toBeNull();
    const nine = Array.from({ length: LABELS_PER_CARD - 1 }, (_, index) => `l${index}`);
    expect(addLabels(nine, "a, b")).toEqual({ labels: nine, error: "limit" });
    expect(addLabels(nine, "a").labels).toHaveLength(LABELS_PER_CARD);
  });
});

describe("resolveFilterEnter", () => {
  const options = ["boodschappen", "Thuis", "werk", "werkgever"];

  it("does nothing for empty text", () => {
    expect(resolveFilterEnter(options, "  ")).toEqual({ kind: "none" });
  });

  it("picks the exact match, even when other names contain it", () => {
    expect(resolveFilterEnter(options, "WERK")).toEqual({ kind: "pick", name: "werk" });
  });

  it("picks the only match", () => {
    expect(resolveFilterEnter(options, "thu")).toEqual({ kind: "pick", name: "Thuis" });
  });

  it("creates when there are several matches or none", () => {
    expect(resolveFilterEnter(options, "wer")).toEqual({ kind: "create" });
    expect(resolveFilterEnter(options, "sport")).toEqual({ kind: "create" });
    expect(resolveFilterEnter([], "sport")).toEqual({ kind: "create" });
  });
});
