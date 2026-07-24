import { describe, expect, it } from "vitest";
import { applyCardMove } from "../lib/boards/optimistic";
import type { BoardColumnWithCards, BoardWithColumns, CardWithLabels } from "../lib/boards/types";

const USER_ID = "user-1";

function makeCard(id: string, columnId: string, position: number): CardWithLabels {
  return {
    id,
    user_id: USER_ID,
    column_id: columnId,
    title: `Card ${id}`,
    description: null,
    priority: "medium",
    size: null,
    due_at: null,
    position,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    labels: [],
  };
}

function makeColumn(id: string, boardId: string, cardIds: string[]): BoardColumnWithCards {
  return {
    id,
    user_id: USER_ID,
    board_id: boardId,
    name: id,
    icon: "Croissant",
    position: 1000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    cards: cardIds.map((cardId, index) => makeCard(cardId, id, (index + 1) * 1000)),
  };
}

function makeBoard(): BoardWithColumns {
  return {
    id: "board-1",
    user_id: USER_ID,
    name: "Test board",
    position: 1000,
    is_favorite: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    columns: [
      makeColumn("col-a", "board-1", ["a1", "a2", "a3"]),
      makeColumn("col-b", "board-1", ["b1"]),
      makeColumn("col-c", "board-1", []),
    ],
  };
}

function columnOrder(board: BoardWithColumns, columnId: string): string[] {
  return board.columns.find((c) => c.id === columnId)!.cards.map((c) => c.id);
}

describe("applyCardMove", () => {
  it("reorders within the same column", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "a1", toColumnId: "col-a", toIndex: 2 });
    expect(columnOrder(next, "col-a")).toEqual(["a2", "a3", "a1"]);
  });

  it("moves a card to the end of the same column via a large index", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "a1", toColumnId: "col-a", toIndex: 99 });
    expect(columnOrder(next, "col-a")).toEqual(["a2", "a3", "a1"]);
  });

  it("moves a card across columns, removing it from the source column", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "a2", toColumnId: "col-b", toIndex: 0 });
    expect(columnOrder(next, "col-a")).toEqual(["a1", "a3"]);
    expect(columnOrder(next, "col-b")).toEqual(["a2", "b1"]);
  });

  it("drops a card into a previously empty column", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "b1", toColumnId: "col-c", toIndex: 0 });
    expect(columnOrder(next, "col-b")).toEqual([]);
    expect(columnOrder(next, "col-c")).toEqual(["b1"]);
  });

  it("clamps a negative index to the start of the column", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "a3", toColumnId: "col-a", toIndex: -5 });
    expect(columnOrder(next, "col-a")).toEqual(["a3", "a1", "a2"]);
  });

  it("leaves the board unchanged when the card id doesn't exist", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "missing", toColumnId: "col-a", toIndex: 0 });
    expect(next).toBe(board);
  });

  it("leaves the board unchanged when the target column id doesn't exist", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { itemId: "a1", toColumnId: "missing", toIndex: 0 });
    expect(next).toBe(board);
  });

  it("does not mutate the input board or its unaffected columns", () => {
    const board = makeBoard();
    const colC = board.columns.find((c) => c.id === "col-c")!;
    const next = applyCardMove(board, { itemId: "a2", toColumnId: "col-b", toIndex: 1 });
    expect(columnOrder(board, "col-a")).toEqual(["a1", "a2", "a3"]);
    expect(next.columns.find((c) => c.id === "col-c")).toBe(colC);
  });
});
