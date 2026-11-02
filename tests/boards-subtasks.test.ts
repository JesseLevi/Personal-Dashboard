import { describe, expect, it } from "vitest";
import { doneColumnOffer, positionForIndex, splitPastedTitles, splitSubtasks, titlesThatFit } from "@/lib/boards/subtasks";

describe("splitSubtasks", () => {
  it("puts open rows before done rows and keeps position order in each", () => {
    const rows = [
      { id: "a", done: true, position: 1 },
      { id: "b", done: false, position: 3 },
      { id: "c", done: false, position: 2 },
      { id: "d", done: true, position: 0 },
    ];
    const { open, done } = splitSubtasks(rows);
    expect(open.map((row) => row.id)).toEqual(["c", "b"]);
    expect(done.map((row) => row.id)).toEqual(["d", "a"]);
  });
});

describe("splitPastedTitles", () => {
  it("makes one title per non-empty line, handling CRLF", () => {
    expect(splitPastedTitles("Taart\r\n  Slingers \n\n\nBallonnen")).toEqual(["Taart", "Slingers", "Ballonnen"]);
  });

  it("cuts a long line to 200 characters", () => {
    expect(splitPastedTitles("x".repeat(250))[0]).toHaveLength(200);
  });

  it("returns nothing for blank text", () => {
    expect(splitPastedTitles(" \n \n")).toEqual([]);
  });
});

describe("titlesThatFit", () => {
  it("keeps only what fits under the 50 cap", () => {
    expect(titlesThatFit(["a", "b", "c"], 48)).toEqual(["a", "b"]);
    expect(titlesThatFit(["a"], 50)).toEqual([]);
    expect(titlesThatFit(["a", "b"], 0)).toEqual(["a", "b"]);
  });
});

describe("doneColumnOffer", () => {
  const columns = [
    { id: "todo", isDone: false },
    { id: "klaar", isDone: true },
    { id: "archief", isDone: true },
  ];

  it("offers the first done column by position", () => {
    expect(doneColumnOffer(columns, "todo")?.id).toBe("klaar");
  });

  it("offers nothing when the card is already in a done column", () => {
    expect(doneColumnOffer(columns, "archief")).toBeNull();
  });

  it("offers nothing when the board has no done column", () => {
    expect(doneColumnOffer([{ id: "todo" }, { id: "bezig", isDone: false }], "todo")).toBeNull();
  });
});

describe("positionForIndex", () => {
  it("goes 1000 before the first row", () => {
    expect(positionForIndex([10, 20, 30], 0)).toBe(10 - 1000);
  });

  it("takes the midpoint between the new neighbours", () => {
    expect(positionForIndex([10, 20, 30], 1)).toBe(15);
    expect(positionForIndex([10, 20, 30], 2)).toBe(25);
  });

  it("goes 1000 after the last row", () => {
    expect(positionForIndex([10, 20, 30], 3)).toBe(30 + 1000);
  });

  it("works with a single neighbour", () => {
    expect(positionForIndex([5], 0)).toBe(5 - 1000);
    expect(positionForIndex([5], 1)).toBe(5 + 1000);
  });

  it("handles a group with no other rows", () => {
    expect(positionForIndex([], 0)).toBe(0);
  });
});
