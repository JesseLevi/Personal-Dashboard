import { describe, expect, it } from "vitest";
import { embeddedCounts } from "@/lib/ui/embedded-counts";

describe("embeddedCounts", () => {
  it("maps each parent row to its embedded count, keeping order", () => {
    const rows = [{ cards: [{ count: 4 }] }, { cards: [{ count: 1 }] }, { cards: [{ count: 0 }] }];
    expect(embeddedCounts(rows, "cards")).toEqual([4, 1, 0]);
  });

  it("treats a missing aggregate as zero and an empty result as no columns", () => {
    expect(embeddedCounts([{ notes: [] }], "notes")).toEqual([0]);
    expect(embeddedCounts([], "notes")).toEqual([]);
  });
});
