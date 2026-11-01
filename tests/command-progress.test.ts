import { describe, expect, it } from "vitest";
import { boardProgress } from "@/lib/command/progress";

describe("boardProgress", () => {
  it("is empty for a board without columns", () => {
    expect(boardProgress([])).toEqual({ total: 0, done: 0 });
  });

  it("is zero for columns without cards", () => {
    expect(
      boardProgress([
        { position: 0, cardCount: 0 },
        { position: 1, cardCount: 0 },
      ]),
    ).toEqual({ total: 0, done: 0 });
  });

  it("counts the last column by position as done, whatever the input order", () => {
    expect(
      boardProgress([
        { position: 3, cardCount: 2 },
        { position: 0, cardCount: 4 },
        { position: 1, cardCount: 1 },
      ]),
    ).toEqual({ total: 7, done: 2 });
  });

  it("is fully done when only the last column holds cards", () => {
    expect(
      boardProgress([
        { position: 0, cardCount: 0 },
        { position: 1, cardCount: 5 },
      ]),
    ).toEqual({ total: 5, done: 5 });
  });

  it("counts every column that ties for the highest position", () => {
    expect(
      boardProgress([
        { position: 0, cardCount: 1 },
        { position: 2, cardCount: 3 },
        { position: 2, cardCount: 2 },
      ]),
    ).toEqual({ total: 6, done: 5 });
  });

  it("uses the isDone flag as soon as any column carries it", () => {
    expect(
      boardProgress([
        { position: 0, cardCount: 2, isDone: true },
        { position: 1, cardCount: 3, isDone: false },
        { position: 2, cardCount: 4, isDone: true },
      ]),
    ).toEqual({ total: 9, done: 6 });
  });

  it("is not done when the flag is present but no column is flagged", () => {
    expect(
      boardProgress([
        { position: 0, cardCount: 2, isDone: false },
        { position: 1, cardCount: 3, isDone: false },
      ]),
    ).toEqual({ total: 5, done: 0 });
  });
});
